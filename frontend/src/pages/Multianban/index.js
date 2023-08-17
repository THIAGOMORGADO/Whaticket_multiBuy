import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Modal from "react-modal";

import api from "../../services/api";
import AsyncBoard from "react-trello";
import { MdClose } from "react-icons/md";

import Skeleton from "@material-ui/lab/Skeleton";
import Avatar from "@material-ui/core/Avatar";

import "./responsive.css";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "row", // Alterado para coluna em telas menores
    alignItems: "center", // Centralizar elementos horizontalmente
    backgroundColor: "#3179ba",
    padding: theme.spacing(1)
  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center"
  },
  btn: {
    backgroundColor: "#555",
    opacity: 0.5,
    width: "13rem",
    height: "3rem",
    border: "none",
    borderRadius: "5px",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "normal",
    marginTop: "12%"
  },
  settingOption: {
    marginLeft: "auto"
  },
  margin: {
    margin: theme.spacing(1)
  },
  headerModal: {
    display: "flex",

    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1)
  },
  tab: {
    fontSize: "80%"
  }
}));

const MultiKanban = () => {
  const classes = useStyles();

  const settings = {
    editable: true,
    canAddLanes: true,
    editLaneTitle: true,
    draggable: true
  };
  const [jsonModalValues, setJsonModalValues] = useState({});
  const [jsonModalTagsInfo, setJsonModalTagsInfo] = useState([]);
  const [jsonModalExtraInfo, setJsonModalExtraInfo] = useState({});
  const [fetchData, setFetchData] = useState([]);
  const [modalIsOpen, setIsOpen] = React.useState(false);
  const [extraInfoLoading, setExtraInfoLoading] = useState(true);
  const [fetchExtraInfos, setFetchExtraInfos] = useState([]);

  const [laneList, setLaneList] = useState({
    laneListStorage: []
  });

  const [file, setFile] = useState({
    lanes: [
      {
        id: "lane1",
        title: "Novos Leads",
        label: "(0)",
        cards: []
      }
    ]
  });

  const fetchTickets = async () => {
    try {
      const { data } = await api.get("/tickets", {});
      return data.tickets;
    } catch (err) {
      return [];
    }
  };

  const popularCards = async () => {
    try {
      const tickets = await fetchTickets();
      console.log(tickets);
      setFetchData(tickets);
      const cards = tickets
        .filter(ticket => ticket.status === "open")
        .map(ticket => ({
          id: ticket.id.toString(),
          title: ticket.contact.name,
          description: ticket.contact.name,
          draggable: true,
          img: ticket.contact.profilePicUrl,
          tags: ticket.tags?.map(tag => ({
            id: tag.id.toString(),
            bgcolor: tag.color,
            title: tag.name
          }))
        }));
        
      setFile(prevFile => ({
        ...prevFile,
        lanes: prevFile.lanes.map(lane => {
          if (lane.id === "lane1") {
            return {
              ...lane,
              cards: cards
            };
          }
         
          return lane;
        })
      }));
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    popularCards();

    loadingStorage();
  }, []);

  const handleCardMove = (cardId, sourceLaneId, targetLaneId) => {
    console.log("cardId:", cardId);
    console.log("sourceLaneId:", sourceLaneId);
    console.log("targetLaneId:", targetLaneId);

    setFile(prevFile => {
      const updatedLanes = prevFile.lanes.map(lane => {
        if (lane.id === sourceLaneId) {
          console.log("Lane.id === sourceLaneId");
          return {
            ...lane,
            cards: lane.cards.filter(card => card.id !== cardId)
          };
        }
        if (lane.id === targetLaneId) {
          console.log("lane.id === targetLaneId");
          return {
            ...lane,
            cards: [
              ...lane.cards,
              prevFile.lanes
                .find(l => l.id === sourceLaneId)
                .cards.find(c => c.id === cardId)
            ]
          };
        }
        return lane;
      });

      return {
        ...prevFile,
        lanes: updatedLanes
      };
    });
  };

  function handleNewLaneAdd(title) {
    const laneNew = title;

    const laneDate = {
      id: laneNew.id,
      title: laneNew.title
    };

    setFile({
      lanes: [...file.lanes, laneDate]
    });

    file.lanes.push(laneDate);
    if (laneList.laneListStorage.length > 0) {
      laneList.laneListStorage = [];
    }
    file.lanes.map(value => {
      if (value.id != "lane1") {
        laneList.laneListStorage.push(value);
      }
    });
    localStorage.setItem("laneDate", JSON.stringify(laneList.laneListStorage));

    console.log(file);
  }

  async function loadingStorage() {
    const response = await JSON.parse(localStorage.getItem("laneDate"));
    if (response) {
      response.map(value => {
        if (value && value["id"] && value["title"]) {
          const newLane = {
            id: value["id"],
            title: value["title"],
            cards: []
          };
          setFile(prevFile => ({
            ...prevFile,
            lanes: [...prevFile.lanes, newLane]
          }));
        }
      });
    }
  }

  async function openModal(cardId) {
    setIsOpen(true);
    console.log(cardId);
    const data = fetchData.find(value => value["id"] == cardId);
    const tags = fetchData.find(item => item.id === cardId);
    setJsonModalTagsInfo(tags); // Que esta retornando aqui
    setJsonModalValues(data["contact"]);
    setJsonModalExtraInfo(data["contact"]);
    setJsonModalTagsInfo(data["tags"]);

    const response = await api.get(`/contacts/${cardId}`);
    setFetchExtraInfos(response.data.extraInfo);
  }

  function closeModal() {
    setIsOpen(false);
  }
  function handleRemoveLane(laneId) {
    const laneDate = JSON.parse(localStorage.getItem("laneDate"));
    console.log(laneDate);
    const laneFiltered = laneDate.filter(lane => lane.id !== laneId);
    localStorage.setItem("laneDate", JSON.stringify(laneFiltered));
  }

  return (
    <div className={classes.root}>
      <AsyncBoard
        data={file}
        {...settings}
        onLaneAdd={handleNewLaneAdd}
        onCardClick={openModal}
        onCardMoveAcrossLanes={handleCardMove}
        onLaneDelete={handleRemoveLane}
        className={classes.tab}
      />
      <div className={customStyles.mobile}>
        <Modal
          isOpen={modalIsOpen}
          style={customStyles}
          onRequestClose={closeModal}
        >
          <div style={customStyles.modalHeader}>
            <h2>Detalhes. {jsonModalExtraInfo["name"]}</h2>
            <button
              onClick={closeModal}
              style={{ border: "none", background: "none" }}
            >
              <MdClose
                size={24}
                color="#ff0000"
                style={{ fontWeight: "bold" }}
              />
            </button>
          </div>

          <div style={customStyles.contactArea}>
            <Avatar
              src={jsonModalValues["profilePicUrl"]}
              alt="logo"
              style={customStyles.logo}
              className={classes.large}
            />
            <div style={customStyles.warpper}>
              <h3>Nome : {jsonModalValues["name"]}</h3>
              <p>email: {jsonModalValues["email"]}</p>
              {jsonModalTagsInfo.map(item => (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <p style={{ background: `${item.color}`, color: "#fff" }}>
                    Tags: {item.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div style={customStyles.otherInfos}>
            <h4>Informacoes do usuario</h4>

            {fetchExtraInfos && extraInfoLoading ? (
              fetchExtraInfos.map(v => (
                <div key={v.id}>
                  <div style={customStyles.listArea}>
                    <span>{v.name}</span> <span> {v.value}</span>
                  </div>
                </div>
              ))
            ) : (
              <Skeleton
                sx={{ bgcolor: "grey.900" }}
                variant={"rectangular"}
                width="100%"
                height={60}
              />
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

const customStyles = {
  content: {
    with: "80vw",
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    marginRight: "-50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  modalHeader: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row"
  },
  contactArea: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: "1rem",
    alignItems: "center",
    marginTop: "10px",
    marginBottom: "10px"
  },
  logo: {
    width: "30%",
    height: "30%"
  },
  apiColor: {
    backgroundColor: "item.color"
  },
  otherInfos: {
    display: "flex",
    flexDirection: "column"
  }
};

export default MultiKanban;
