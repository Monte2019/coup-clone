function PlayerBoard({ name, hiddenCards, hiddenCount, revealedCards }) {
  // render back‐of‐card icons for each hidden slot:
  const backs = hiddenCards
    ? hiddenCards.map((_, i) => <CardBack key={i}/> )
    : Array(hiddenCount).fill().map((_,i)=><CardBack key={i}/>);
  return (
    <div>
      <h3>{name}</h3>
      <div className="flex">{backs}</div>
      <div className="flex mt-2">
        {revealedCards.map((c,i)=><CardFace animal={c} key={i}/>)}
      </div>
    </div>
  );
}
