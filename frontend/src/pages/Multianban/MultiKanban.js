import React, { useEffect, useState } from "react";
import api from "../../services/api";
import AsyncBoard from "react-trello";
import { useStyles } from ".";

export const MultiKanban = () => {
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
        title: "Novos Leads",
        label: "(0)",
        cards: []
      }
    ]
  });
  const [arraeNew, setArreyNew] = useState({});

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

    localStorage.setItem("laneDate", JSON.stringify({ laneDate }));

    console.log(file);
  }

  async function loadingStorage() {
    const response = await JSON.parse(localStorage.getItem("laneDate"));
    console.log("o que rem no resposne", response);
    if (response.length > 0) {
      if (
        prevFile => ({
          ...prevFile,
          lanes: prevFile.lanes.map(lane => {
            if (lane.id === "lane2") {
              return {
                ...lane,
                cards: cards
              };
            }
            return lane;
          })
        })
      );
    }
  }

  useEffect(() => {
    loadingStorage();
  }, []);

  return (
    <div className={classes.root}>
      <AsyncBoard
        data={file}
        {...settings}
        onLaneAdd={handleNewLaneAdd}
        onCardMoveAcrossLanes={handleCardMove}
        className={classes.tab}
      />
    </div>
  );
};
