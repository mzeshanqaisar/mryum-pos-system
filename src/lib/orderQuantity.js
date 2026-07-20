export function toPieces(boxes, pieces, piecesPerBox) {
  const perBox = Number(piecesPerBox) > 1 ? Number(piecesPerBox) : 1
  return (Number(boxes) || 0) * perBox + (Number(pieces) || 0)
}

export function fromPieces(totalPieces, piecesPerBox) {
  const perBox = Number(piecesPerBox)
  const total = Number(totalPieces) || 0
  if (!(perBox > 1)) return { boxes: 0, pieces: total }
  return { boxes: Math.floor(total / perBox), pieces: total % perBox }
}
