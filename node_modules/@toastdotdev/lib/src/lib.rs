#![deny(clippy::all)]

use esinstall::ImportMap;
use fs_extra::dir::{copy, CopyOptions};
use futures::stream::StreamExt;
use miette::{IntoDiagnostic, WrapErr};
use serde_json::Value;
use sources::{Source, SourceKind};
use std::{
  collections::HashMap,
  fs,
  path::{Path, PathBuf},
};
use tokio::sync::{
  mpsc::{unbounded_channel, UnboundedSender},
  OnceCell,
};
use tokio_stream::wrappers::UnboundedReceiverStream;
use walkdir::WalkDir;

mod cache;
mod esinstall;
mod internal_api;
mod sources;
mod swc_import_map_rewrite;
mod swc_ops;

use internal_api::{Event, ModuleSpec, SetDataForSlug};

#[macro_use]
extern crate napi_derive;

const VERSION: &str = env!("CARGO_PKG_VERSION");
static ONCE: OnceCell<UnboundedSender<Event>> =
  OnceCell::const_new();

#[napi]
fn version() -> &'static str {
  VERSION
}

#[derive(Debug)]
struct OutputFile {
  dest: String,
}

#[napi]
fn done_sourcing_data() -> napi::Result<()> {
  while !ONCE.initialized() {}
  let sender = {
    let tx = ONCE.get();
    tx.clone().unwrap()
  };

  match sender.send(Event::End) {
    Ok(_) => Ok(()),
    Err(_) => Ok(()),
  }
}
#[napi]
async fn set_data_for_slug(
  user_input: String,
) -> napi::Result<()> {
  while !ONCE.initialized() {}
  let sender = {
    let tx = ONCE.get();
    tx.clone().unwrap()
  };
  let data: SetDataForSlug =
    serde_json::from_str(&user_input).unwrap();
  match sender.send(Event::Set(data)) {
    Ok(_) => Ok(()),
    Err(_) => Ok(()),
  }
}

#[napi]
async fn incremental(
  input_dir: String,
  output_dir: String,
) -> napi::Result<Vec<String>> {
  match incremental_internal(input_dir, output_dir).await {
    Ok(urls) => Ok(urls),
    Err(e) => {
      dbg!("oh no! our table! it's broken!");
      println!("{}", e);
      Ok(vec![])
    }
  }

  // Ok(vec!["testing".to_string(), "paths".to_string()])
}

async fn incremental_internal(
  input_dir: String,
  output_dir: String,
) -> miette::Result<Vec<String>> {
  let mut cache = cache::init();

  let (tx, rx) = unbounded_channel();
  let goodbye_tx = tx.clone();
  ONCE.set(goodbye_tx).unwrap();
  // Create the output directory and any intermediary directories
  // we need
  std::fs::create_dir_all(&output_dir)
    .into_diagnostic()
    .wrap_err(format!(
      "Failed create directories for path `{}`",
      &output_dir
    ))?;

  let import_map = {
    let import_map_filepath = PathBuf::from(&output_dir)
      .join("web_modules")
      .join("import-map.json");
    let contents = fs::read_to_string(&import_map_filepath)
    .into_diagnostic()
    .wrap_err(format!(
      "Failed to read `import-map.json` from `{}`

esinstall should create this directory. It looks like it either didn't run or failed to create the directory.",
      &import_map_filepath.display()
    ))?;

    esinstall::parse_import_map(&contents)
    .into_diagnostic().wrap_err(
      format!(
          "Failed to parse import map from content `{}` at `{}`",
          contents,
          &import_map_filepath.display()
      )
  )?
  };

  let tmp_dir = PathBuf::from(&input_dir).join(".tmp");
  std::fs::create_dir_all(&tmp_dir).into_diagnostic().wrap_err(
    format!(
        "Failed to create directories for tmp_dir `{}`. Can not compile files into directory that doesn't exist, exiting.",
        &tmp_dir.display()
    )
  )?;
  let mut stream = UnboundedReceiverStream::new(rx);

  // let mut urls = vec![];
  let mut set_data_events = vec![];
  while let Some(msg) = stream.next().await {
    match msg {
      Event::Set(mut info) => {
        info.normalize();
        set_data_events.push(info.clone());
        // urls.push(info.slug.clone());

        let slug_filepath =
          info.slug_as_relative_filepath();
        let mut output_path_js =
          info.slug_as_relative_filepath();
        output_path_js.set_extension("js");

        // if there is a component, set the source in the incremental cache
        // if it's a filepath, we need to figure out how to handle it. I think
        // that we just need to make sure the filepaths are relative to the project
        // root so that the incremental cache ids for the sources line up when
        // we go to render it out or whatnot
        match &info.component {
          None => {}
          Some(ModuleSpec::NoModule) => {
            panic!("no-module is not implemented for components yet")
          }
          Some(ModuleSpec::File { path: _ }) => {
            panic!("Filepaths are not implemented yet")
          }
          Some(ModuleSpec::Source { code }) => {
            cache.set_source(
              &info.slug,
              Source {
                source: code.to_string(),
                kind: SourceKind::Raw,
              },
            );
            compile_js(
              &info.slug,
              &OutputFile {
                dest: output_path_js.display().to_string(),
              },
              &PathBuf::from(&output_dir),
              &import_map,
              &mut cache,
              &tmp_dir,
            )?;
          }
        }
        match &info.data {
          Some(Value::Null) => {
            // if null, do nothing for now. In the future null
            // will cause us to overlay a tombstone on this layer
            // similar to an overlay filesystem, resulting in no data
            // for the page.
          }
          Some(v) => {
            // we write the files out to disk here today,
            // we should probably put them in the incremental cache first
            // so that files can depend on them via derived queries
            let mut json_path = PathBuf::from(&output_dir)
              .join(slug_filepath);
            json_path.set_extension("json");
            std::fs::create_dir_all(
              &json_path.parent().unwrap(),
            )
            .into_diagnostic()?;
            fs::write(json_path, v.to_string())
              .into_diagnostic()?
          }
          None => {}
        }
        match &info.wrapper {
          Some(_) => {
            panic!("set.wrapper is not implemented yet");
          }
          None => {}
        }
      }
      Event::End => {
        break;
      }
    }
  }

  let files_by_source_id = compile_src_files(
    &PathBuf::from(&input_dir),
    &PathBuf::from(output_dir),
    &import_map,
    &mut cache,
    &tmp_dir,
  )?;
  // render_src_pages()?;
  let file_list = files_by_source_id
    .iter()
    .map(|(_, output_file)| output_file.dest.clone())
    .collect::<Vec<String>>();

  // todo area

  let remote_file_list: Vec<String> = set_data_events
    .iter()
    .filter_map(|set| {
      match (&set.component, &set.prerender) {
        // if we have a component set, and we are supposed to prerender this component
        // into html, then keep it for later processing.
        (Some(_), true) => {
          let mut js_filepath =
            set.slug_as_relative_filepath();
          js_filepath.set_extension("js");
          Some(js_filepath.display().to_string())
        }
        _ => None,
      }
    })
    .collect();
  let mut list: Vec<String> = file_list
    .clone()
    .iter()
    .filter(|f| f.starts_with("src/pages"))
    .cloned()
    .collect();
  list.extend(remote_file_list);

  // # copy static dir to public dir
  //
  // * copy_inside seems to be for copying the whole `static` folder to
  //   `public/static`.
  // * `content_only` seems to be for copying `static/*` into `public/`
  let options = CopyOptions {
    copy_inside: false,
    overwrite: true,
    content_only: true,
    ..CopyOptions::new()
  };
  let static_dir = PathBuf::from(&input_dir).join("static");
  let public_dir = PathBuf::from(&input_dir).join("public");
  if static_dir.exists() && public_dir.exists() {
    copy(static_dir, public_dir, &options)
      .into_diagnostic()?;
  }

  // render_to_html(
  //   tmp_dir.into_os_string().into_string().unwrap(),
  //   output_dir.into_os_string().into_string().unwrap(),
  //   list,
  //   npm_bin_dir,
  //   render_pb.clone(),
  // )?;
  Ok(list)
}

// #[instrument(skip(cache))]
fn compile_src_files(
  project_root_dir: &PathBuf,
  output_dir: &PathBuf,
  import_map: &ImportMap,
  cache: &mut cache::Cache,
  tmp_dir: &Path,
) -> miette::Result<HashMap<String, OutputFile>> {
  let files_by_source_id: HashMap<String, OutputFile> =
    WalkDir::new(&project_root_dir.join("src"))
      .into_iter()
      // only scan .js files
      .filter(|result| {
        result.as_ref().map_or(false, |dir_entry| {
          dir_entry
            .file_name()
            .to_str()
            .map(|filename| filename.ends_with(".js"))
            .unwrap_or(false)
        })
      })
      // insert source files into cache and return a
      // HashMap so we can access the entries and such later
      // by source_id
      .fold(HashMap::new(), |mut map, entry| {
        let e = entry.unwrap();
        let path_buf = e.path().to_path_buf();
        let file_stuff = cache.read(path_buf.clone());
        let source_id = e
          .path()
          .strip_prefix(&project_root_dir)
          .unwrap()
          .to_str()
          .unwrap();
        cache.set_source(
          source_id,
          Source {
            source: file_stuff,
            kind: SourceKind::File {
              relative_path: path_buf,
            },
          },
        );

        map.entry(String::from(source_id)).or_insert(
          OutputFile {
            dest: source_id.to_string(),
          },
        );
        map
      });
  for (source_id, output_file) in files_by_source_id.iter()
  {
    compile_js(
      source_id,
      output_file,
      output_dir,
      import_map,
      cache,
      tmp_dir,
    )?;
  }
  Ok(files_by_source_id)
}

fn compile_js(
  source_id: &str,
  output_file: &OutputFile,
  output_dir: &PathBuf,
  import_map: &ImportMap,
  cache: &mut cache::Cache,
  tmp_dir: &Path,
) -> miette::Result<()> {
  let browser_output_file =
    output_dir.join(Path::new(&output_file.dest));
  let js_browser =
    cache.get_js_for_browser(source_id, import_map.clone());
  let file_dir = browser_output_file
    .parent()
    .ok_or(&format!(
      "could not get .parent() directory for `{}`",
      &browser_output_file.display()
    ))
    .unwrap();
  // .into_diagnostic()?;
  std::fs::create_dir_all(&file_dir)
    .into_diagnostic()
    .wrap_err(format!(
      "Failed to create parent directories for `{}`. ",
      &browser_output_file.display()
    ))?;
  let _res =
    std::fs::write(&browser_output_file, js_browser)
      .into_diagnostic()
      .wrap_err(format!(
        "Failed to write browser JS file for `{}`. ",
        &browser_output_file.display()
      ))?;

  let js_node = cache.get_js_for_server(source_id);
  let mut node_output_file = tmp_dir.to_path_buf();
  node_output_file.push(&output_file.dest);
  // node_output_file.set_extension("mjs");
  let file_dir = node_output_file
    .parent()
    .ok_or(format!(
      "could not get .parent() directory for `{}`",
      &node_output_file.display()
    ))
    .unwrap();
  std::fs::create_dir_all(&file_dir)
    .into_diagnostic()
    .wrap_err(format!(
      "Failed to create parent directories for `{}`. ",
      &browser_output_file.display()
    ))?;

  std::fs::write(&node_output_file, js_node)
    .into_diagnostic()
    .wrap_err(format!(
      "Failed to write node JS file for `{}`. ",
      &node_output_file.display()
    ))?;
  Ok(())
}
