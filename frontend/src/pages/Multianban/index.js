import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import Board from "react-trello";

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

  const [file, setFile] = useState({
    lanes: [
      {
        id: "lane1",
        title: "Novo leads",
        label: "multiBuy",
        cards: []
      }
    ]
  });

  const fetchTickets = async () => {
    try {
      const { data } = await api.get("/tickets", {});
      console.log(data.tickets);
      return data.tickets;
    } catch (err) {
      console.log(err);
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
          label: ticket.contact.name,
          draggable: true
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
    // eslint-disable-next-line
  }, []);

  const handleCardMove = (cardId, sourceLaneId, targetLaneId) => {
    setFile(prevFile => {
      const updatedLanes = prevFile.lanes.map(lane => {
        if (lane.id === sourceLaneId) {
          return {
            ...lane,
            cards: lane.cards.filter(card => card.id !== cardId)
          };
        }
        if (lane.id === targetLaneId) {
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

  const handleDragStart = (cardId, laneId) => {
    console.log("drag started");
    console.log(`cardId: ${cardId}`);
    console.log(`laneId: ${laneId}`);
  };

  const handleDragEnd = (cardId, sourceLaneId, targetLaneId) => {
    console.log("drag ended");
    console.log(`cardId: ${cardId}`);
    console.log(`sourceLaneId: ${sourceLaneId}`);
    console.log(`targetLaneId: ${targetLaneId}`);
  };
  return (
    <div className={classes.root}>
      <Board
        data={file}
        {...settings}
        handleDragStart={handleDragStart}
        handleDragEnd={handleDragEnd}
        onCardMoveAcrossLanes={handleCardMove}
      />
    </div>
  );
};

export default MultiKanban;
