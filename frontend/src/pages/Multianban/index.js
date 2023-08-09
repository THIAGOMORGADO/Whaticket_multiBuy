import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import AsyncBoard, { Lane } from "react-trello";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "row",
    alignItems: "start",
    padding: theme.spacing(1),
    backgroundColor: "#3179ba"
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
    marginTop: "12px"
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
      // console.log(data.tickets);
      return data.tickets;
    } catch (err) {
      // console.log(err);
      return [];
    }
  };

  const popularCards = async () => {
    try {
      const tickets = await fetchTickets();
      const cards = tickets
        .filter(ticket => ticket.status === "open")
        .map(ticket => ({
          id: ticket.id.toString(),
          title: "Ticket nº " + ticket.id.toString(),
          description: ticket.contact.number + "\n\n" + ticket.lastMessage,
          draggable: true,
          tags: ticket.tags?.map(tag => ({
            id: tag.id.toString(),
            bgcolor: tag.color,
            title: tag.name
          }))
        }));

      // console.log("esse array e o que a gente", cards);

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
    console.log("o que rem no resposne", response);
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

  useEffect(() => {
    loadingStorage();
  }, []);
  function handleOpenModalCard(cardId, metadata, laneId) {
    const data = {
      cardId,
      metadata,
      laneId
    };
    console.log(data);
  }
  return (
    <div className={classes.root}>
      <AsyncBoard
        data={file}
        {...settings}
        onLaneAdd={handleNewLaneAdd}
        onCardClick={handleOpenModalCard}
        onCardMoveAcrossLanes={handleCardMove}
        className={classes.tab}
      />
    </div>
  );
};

export default MultiKanban;
