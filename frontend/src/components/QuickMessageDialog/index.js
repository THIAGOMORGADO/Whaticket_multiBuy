import React, { useState, useEffect, useContext, useRef } from "react";
import {
  Button,
  TextField,
  DialogContent,
  DialogActions,
  Grid
} from "@material-ui/core";
import PropType from "prop-types";
import Dialog from "../Dialog";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { i18n } from "../../translate/i18n";
import { makeStyles } from "@material-ui/core/styles";
import ButtonWithSpinner from "../ButtonWithSpinner";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import MicIcon from "@material-ui/icons/Mic";
import { AuthContext } from "../../context/Auth/AuthContext";
import ConfirmationModal from "../ConfirmationModal";
import api from "../../services/api";

import { head, isNil, isObject, has, get } from "lodash";

import { IconButton } from "@material-ui/core";

const MessageSchema = Yup.object().shape({
  shortcode: Yup.string()
    .min(3, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  message: Yup.string()
    .min(3, "Too Short!")
    .max(1000, "Too Long!")
    .required("Required")
});

const useStyles = makeStyles(theme => ({
  root: {
    "& .MuiTextField-root": {
      margin: theme.spacing(1),
      width: "350px"
    }
  },
  list: {
    width: "100%",
    maxWidth: "350px",
    maxHeight: "200px",
    backgroundColor: theme.palette.background.paper
  },
  inline: {
    width: "100%"
  }
}));

function QuickMessageDialog(props) {
  const classes = useStyles();

  const initialMessage = {
    id: null,
    shortcode: "",
    message: "",
    sendAsVoiceNote: false
  };

  const {
    modalOpen,
    saveMessage,
    editMessage,
    onClose,
    messageSelected,
    mediaDelete
  } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const attachmentFile = useRef(null);

  const { user } = useContext(AuthContext);

  useEffect(() => {
    verifyAndSetMessage();
    setDialogOpen(modalOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  useEffect(() => {
    verifyAndSetMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageSelected]);

  const messageSelectedIsValid = () => {
    return (
      isObject(messageSelected) &&
      has(messageSelected, "id") &&
      !isNil(get(messageSelected, "id"))
    );
  };

  const verifyAndSetMessage = () => {
    if (messageSelectedIsValid()) {
      const { id, message, shortcode, mediaPath, mediaName, sendAsVoiceNote } =
        messageSelected;
      setMessage({
        id,
        message,
        shortcode,
        mediaPath,
        mediaName,
        sendAsVoiceNote
      });
      if (mediaPath) {
        setAttachment({
          name: mediaName,
          isAudioFile: isAudio({ name: mediaPath })
        });
      }
    } else {
      setMessage(initialMessage);
    }
  };

  const handleClose = () => {
    setAttachment(null);
    onClose();
    setLoading(false);
  };

  const isAudio = file => {
    if (file.name.endsWith(".mp3")) {
      return true;
    }

    return false;
  };

  const handleAttachmentFile = e => {
    const file = head(e.target.files);
    if (file) {
      file.isAudioFile = isAudio(file);
      setAttachment(file);
    }
  };

  const handleAttachmentRemove = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    if (message.mediaName) {
      await mediaDelete(message.id);
      setAttachment(null);
      setMessage(v => ({ ...v, mediaPath: null, mediaName: null }));
    }
  };

  const handleSave = async values => {
    if (messageSelectedIsValid()) {
      editMessage(
        {
          ...messageSelected,
          ...values,
          userId: user.id
        },
        attachment
      );
    } else {
      saveMessage(
        {
          ...values,
          userId: user.id
        },
        attachment
      );
    }
    handleClose();
  };

  return (
    <>
      <ConfirmationModal
        title={i18n.t("scheduleModal.title.delete")}
        open={deleteConfirmationOpen}
        onClose={() => setDeleteConfirmationOpen(false)}
        onConfirm={() => handleAttachmentRemove()}
      >
        {i18n.t("scheduleModal.deleteMessage")}
      </ConfirmationModal>
      <Dialog
        title="Mensagem Rápida"
        modalOpen={dialogOpen}
        onClose={handleClose}
      >
        <Formik
          initialValues={message}
          enableReinitialize={true}
          validationSchema={MessageSchema}
          onSubmit={(values, actions) => {
            setLoading(true);
            setTimeout(() => {
              handleSave(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors }) => (
            <Form>
              <DialogContent className={classes.root} dividers>
                <Grid direction="column" container>
                  <Grid item>
                    <Field
                      as={TextField}
                      name="shortcode"
                      label={i18n.t("quickMessages.dialog.shortcode")}
                      error={touched.shortcode && Boolean(errors.shortcode)}
                      helperText={touched.shortcode && errors.shortcode}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item>
                    <Field
                      as={TextField}
                      name="message"
                      rows={6}
                      label={i18n.t("quickMessages.dialog.message")}
                      multiline={true}
                      error={touched.message && Boolean(errors.message)}
                      helperText={touched.message && errors.message}
                      variant="outlined"
                    />
                  </Grid>
                  <div style={{ display: "none" }}>
                    <input
                      type="file"
                      ref={attachmentFile}
                      accept=".mp3,.png,.jpg,.mp4,.pdf"
                      onChange={e => handleAttachmentFile(e)}
                    ></input>
                  </div>
                  {attachment && (
                    <div>
                      <Button
                        onClick={() => {
                          if (!attachment.isAudioFile) return;
                          setMessage(v => ({
                            ...v,
                            sendAsVoiceNote: !v.sendAsVoiceNote
                          }));
                        }}
                        startIcon={
                          message.sendAsVoiceNote ? (
                            <MicIcon />
                          ) : (
                            <AttachFileIcon />
                          )
                        }
                      >
                        {attachment?.name}
                      </Button>
                      <IconButton
                        onClick={() => setDeleteConfirmationOpen(true)}
                        color="secondary"
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </div>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions>
                {!attachment && !message.mediaPath && (
                  <Button
                    color="primary"
                    onClick={() => attachmentFile.current.click()}
                    variant="outlined"
                  >
                    {i18n.t("announcements.dialog.buttons.attach")}
                  </Button>
                )}
                <Button
                  onClick={handleClose}
                  color="secondary"
                  variant="outlined"
                >
                  Cancelar
                </Button>
                <ButtonWithSpinner
                  loading={loading}
                  color="primary"
                  type="submit"
                  variant="contained"
                  autoFocus
                >
                  Salvar
                </ButtonWithSpinner>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </>
  );
}

QuickMessageDialog.propType = {
  modalOpen: PropType.bool,
  onClose: PropType.func
};

export default QuickMessageDialog;
