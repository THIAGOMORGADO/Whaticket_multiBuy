use std::sync::Arc;
use tracing::instrument;

use swc::{
  self,
  common::{
    errors::{ColorConfig, Handler},
    FileName, SourceMap,
  },
  config::{
    Config, GlobalInliningPassEnvs, GlobalPassOption,
    IsModule, JscConfig, JscTarget, OptimizerConfig,
    Options, SourceMapsConfig, TransformConfig,
  },
  ecmascript::{
    parser::{EsConfig, Syntax},
    transforms::react,
    visit::{noop_fold_type, Fold, FoldWith},
  },
};
// use swc_ecma_parser::{EsConfig, Syntax};
// use swc_ecma_transforms::react;
// use swc_ecma_visit::{Fold, FoldWith};

use crate::{
  esinstall::ImportMap,
  swc_import_map_rewrite::SWCImportMapRewrite,
};

struct Noop;
impl Fold for Noop {
  noop_fold_type!();
}
#[instrument]
pub fn compile_js_for_browser(
  source: String,
  filename: String,
  import_map: ImportMap,
) -> String {
  let opts = &get_opts();
  let cm = Arc::<SourceMap>::default();
  let handler = Arc::new(Handler::with_tty_emitter(
    ColorConfig::Auto,
    true,
    false,
    Some(cm.clone()),
  ));

  let compiler = swc::Compiler::new(cm.clone());

  let fm = cm.new_source_file(
    FileName::Custom(filename.clone()),
    source,
  );

  let parsed_program = compiler.parse_js(
    fm.clone(),
    &handler,
    JscTarget::Es2020,
    get_syntax(),
    IsModule::Bool(true),
    true,
  );
  //   let built_config = compiler.config_for_file(
  //     &handler,
  //     opts,
  //     &FileName::Custom(filename.clone()),
  //   );
  //   let post_transform_program =
  //     parsed_program.map(|program| {
  //       program.fold_with(&mut SWCImportMapRewrite {
  //         import_map: &import_map,
  //       })
  //     });
  //   let result = compiler.transform(
  //     &handler,
  //     post_transform_program.unwrap(),
  //     false,
  //     // built_config.unwrap().unwrap().pass,
  //   );
  let result = compiler.process_js_with_custom_pass(
    fm.clone(),
    parsed_program.ok(),
    &handler,
    &opts,
    |prog| SWCImportMapRewrite {
      import_map: &import_map,
    },
    |prog| Noop,
  );
  // .and_then(|program| {
  //     if let Program::Module(mut module) = program {
  //         // println!("Matched {:?}!", i);
  //         module.visit_mut_with(&mut SVGImportToComponent {
  //             filepath: Path::new(&filename),
  //             npm_bin_dir: npm_bin_dir,
  //         });
  //         // program.print();
  //         return Ok(Program::Module(module));
  //     } else {
  //         // return error
  //         return Err(anyhow!("it's a script, dang"));
  //     }
  // });

  //   let output = compiler.print(
  //     &result,
  //     Some(&filename),
  //     None,
  //     JscTarget::Es2020,
  //     SourceMapsConfig::default(),
  //     None,
  //     false,
  //     None,
  //   );

  result.unwrap().code
}

#[instrument]
pub fn compile_js_for_server(
  source: String,
  filename: String,
) -> String {
  let opts = &get_opts();

  let cm = Arc::<SourceMap>::default();
  let handler = Arc::new(Handler::with_tty_emitter(
    ColorConfig::Auto,
    true,
    false,
    Some(cm.clone()),
  ));

  let compiler = swc::Compiler::new(cm.clone());

  let fm = cm.new_source_file(
    FileName::Custom(filename.clone()),
    source,
  );

  let parsed_program = compiler.parse_js(
    fm.clone(),
    &handler,
    JscTarget::Es2020,
    get_syntax(),
    IsModule::Bool(true),
    true,
  );
  //   let built_config = compiler.config_for_file(
  //     &handler,
  //     opts,
  //     &FileName::Custom(filename.clone()),
  //   );

  //   let result = compiler.transform(
  //     &handler,
  //     parsed_program.unwrap(),
  //     false,
  //     built_config.unwrap().unwrap().pass,
  //   );
  let result = compiler.process_js_with_custom_pass(
    fm.clone(),
    parsed_program.ok(),
    &handler,
    &opts,
    |prog| Noop,
    |prog| Noop,
  );
  // .and_then(|program| {
  //     if let Program::Module(mut module) = program {
  //         // println!("Matched {:?}!", i);
  //         module.visit_mut_with(&mut SVGImportToComponent {
  //             filepath: Path::new(&filename),
  //             npm_bin_dir: npm_bin_dir,
  //         });
  //         // program.print();
  //         return Ok(Program::Module(module));
  //     } else {
  //         // return error
  //         return Err(anyhow!("it's a script, dang"));
  //     }
  // });

  //   let output = compiler.print(
  //     &result,
  //     Some(&filename),
  //     None,
  //     JscTarget::Es2020,
  //     SourceMapsConfig::default(),
  //     None,
  //     false,
  //     None,
  //   );

  result.unwrap().code
}

#[instrument]
fn get_opts() -> Options {
  let envs = {
    let set = GlobalInliningPassEnvs::default();
    match set {
      GlobalInliningPassEnvs::List(mut inner_set) => {
        for (k, _) in std::env::vars() {
          if k.starts_with("TOAST_") {
            inner_set.insert(k);
          }
        }
        GlobalInliningPassEnvs::List(inner_set)
      }
      _ => {
        panic!("didn't expect GlobalInlingPassEnvs to be a Map, expected List. This is a bug in Toast");
      }
    }
  };
  Options {
    is_module: IsModule::Bool(true),
    config: Config {
      jsc: JscConfig {
        target: Some(JscTarget::Es2020),
        syntax: Some(Syntax::Es(EsConfig {
          jsx: true,
          nullish_coalescing: true,
          optional_chaining: true,
          dynamic_import: true,
          ..Default::default()
        })),
        transform: Some(TransformConfig {
          react: react::Options {
            pragma: "h".to_string(),
            pragma_frag: "Fragment".to_string(),
            use_builtins: true,
            ..Default::default()
          },
          optimizer: Some(OptimizerConfig {
            globals: Some(GlobalPassOption {
              envs,
              ..Default::default()
            }),
            ..Default::default()
          }),
          ..Default::default()
        }),
        ..Default::default()
      },
      ..Default::default()
    },
    ..Default::default()
  }
}

#[instrument]
fn get_syntax() -> Syntax {
  Syntax::Es(EsConfig {
    jsx: true,
    nullish_coalescing: true,
    optional_chaining: true,
    dynamic_import: true,
    ..Default::default()
  })
}
