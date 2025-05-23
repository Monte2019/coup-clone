import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import socket from "./socket"; // wherever you instantiate & export your io-client socket
import PlayerBoard from "./PlayerBoard"; // your component to render each player

export default function Game() {
  const { roomCode } = useParams();
  const [hiddenCards, setHiddenCards] = useState([]);
  const [revealedCards, setRevealedCards] = useState([]);
  const [otherPlayers, setOtherPlayers] = useState([]); 
  // e.g. [{ playerId, name, hiddenCount, revealed: [] }, …]

  useEffect(() => {
    // 1) Receive your initial hand & transition in
    socket.on("yourRoles", (roles) => {
      setHiddenCards(roles);
      // Optionally fetch/update list of players here
    });

    // 2) When you lose a card
    socket.on("cardLost", (lost) => {
      setHiddenCards((prev) => {
        const ix = prev.indexOf(lost);
        if (ix === -1) return prev;
        const copy = [...prev];
        copy.splice(ix, 1);
        return copy;
      });
      setRevealedCards((prev) => [...prev, lost]);
    });

    // 3) When someone else loses
    socket.on("playerLostCard", ({ playerId, lostAnimal }) => {
      setOtherPlayers((players) =>
        players.map((p) =>
          p.playerId === playerId
            ? {
                ...p,
                hiddenCount: p.hiddenCount - 1,
                revealed: [...p.revealed, lostAnimal],
              }
            : p
        )
      );
    });

    return () => {
      socket.off("yourRoles");
      socket.off("cardLost");
      socket.off("playerLostCard");
    };
  }, [roomCode]);

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Predator’s Bluff — Room {roomCode}</h2>
      <div className="flex space-x-4">
        {/* Your board */}
        <PlayerBoard
          name="You"
          hiddenCards={hiddenCards}
          revealedCards={revealedCards}
        />
        {/* Other players */}
        {otherPlayers.map((p) => (
          <PlayerBoard
            key={p.playerId}
            name={p.name}
            hiddenCount={p.hiddenCount}
            revealedCards={p.revealed}
          />
        ))}
      </div>
    </div>
  );
}
