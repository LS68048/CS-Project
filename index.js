var boardDOM = [];
var playerColor = "w";
const promoter = document.getElementById("promoter");
var historyBoard = document.getElementById("movelist");
var historyBoardElems = [];
const boardElem = document.querySelector("#board");
var highlightedMove;

var gameHistory = [];
var undoneMoves = [];

const pieceMap = {
    wr: "Chess_rlt45.svg",
    wn: "Chess_nlt45.svg",
    wb: "Chess_blt45.svg",
    wq: "Chess_qlt45.svg",
    wk: "Chess_klt45.svg",
    wp: "Chess_plt45.svg",
    br: "Chess_rdt45.svg",
    bn: "Chess_ndt45.svg",
    bb: "Chess_bdt45.svg",
    bq: "Chess_qdt45.svg",
    bk: "Chess_kdt45.svg",
    bp: "Chess_pdt45.svg",
};

const worker = new Worker('./worker.js');

worker.onmessage = function(event) {
    const { type, moveToPerform } = event.data;

    if (type === "moveTime") {
        const fromEl = document.getElementById(moveToPerform.from);
        const toEl = document.getElementById(moveToPerform.to);
        move(fromEl, toEl, moveToPerform.promotion);
    }
    else {
        console.log(event);
    }
};

function init_board() {
    for (let rank = 0; rank < 8; rank++) {
        var rankElem = document.createElement("tr");
        boardElem.appendChild(rankElem);
        boardDOM.push([]);
        for (let file = 0; file < 8; file++) {
            var displayRank = playerColor == "b" ? rank : 7 - rank;
            var squareElem = document.createElement("td");
            var square = String.fromCharCode(file + 97) + (displayRank + 1);
            squareElem.classList.add("square");
            squareElem.classList.add(
                (displayRank * 7 + file) % 2 == 0 ? "dark" : "light"
            );
            squareElem.id = square;
            squareElem.dataset.square = square;
            squareElem.dataset.piece = null;
            rankElem.appendChild(squareElem);
            boardDOM[rank].push(squareElem);
        }
    }

    if (playerColor == "w") {
        document.getElementById("blackEval").parentNode.style.display = "block";
    }

    // Setup promoter
    const pieces = ["r", "n", "b", "q"];
    for (const piece of pieces) {
        const div = document.createElement("div");
        var img = document.createElement("img");
        img.src = `Pieces/${pieceMap[playerColor + piece]}`;
        img.classList.add("piece");
        img.style.position = "static";
        img.style.transform = "translate(0, 0)";
        img.style.cursor = "pointer";
        img.draggable = false;
        div.appendChild(img);
        div.classList.add("img-container");
        div.onclick = (e) => {
            move(dragStartSquare, promoteSquare, piece);
        };
        promoter.insertBefore(div, promoter.firstChild);
    }

    // Restore moves list if saved game
    if (gameHistory.length > 0) {
        refreshHistoryBoard();
    }
}

function updateDOM() {
    if (game.isGameOver()) {
        boardElem.innerHTML = "GAME OVER NERD";
        return;
    }
    for (const rank of boardDOM) {
        for (const square of rank) {
            var expected = game.get(square.dataset.square);

            square.dataset.piece = null;
            square.querySelector("img")?.remove();

            if (expected != null) {
                square.dataset.piece = `${expected.color}${expected.type}`;
                var img = document.createElement("img");
                img.src = `Pieces/${pieceMap[square.dataset.piece]}`;
                img.classList.add("piece");
                img.draggable = false;
                img.onmousedown = mouseDown;
                square.appendChild(img);
            }
        }
    }
    evaluate();
}

var draggedPiece;
var dragStartSquare;
var offsetX = 0;
var offsetY = 0;
var promoteSquare;

var highlightedSquares = [];
var hints = [];
var hoveredSquare;
var recentHighlight;

var toggle = false;

function mouseDown(e) {
    e.preventDefault();

    if (promoteSquare) {
        return;
    }

    draggedPiece = e.target;
    const rect = draggedPiece.getBoundingClientRect();
    offsetX = e.clientX - rect.width / 2;
    offsetY = e.clientY - rect.height / 2;
    dragStartSquare = draggedPiece.parentNode;

    draggedPiece.style.zIndex = 100;
    draggedPiece.classList.add("dragging");

    if (recentHighlight) {
        recentHighlight.classList.remove("highlighted");
        recentHighlight.classList.remove("hovered");
    }

    if (dragStartSquare == recentHighlight) {
        toggle = true;
    }

    dragStartSquare.classList.add("highlighted");
    dragStartSquare.classList.add("hovered");
    recentHighlight = e.target.parentNode;
    hoveredSquare = dragStartSquare;

    clearHints();
    generateHints();

    // Prevent dragging pieces when it's not your turn
    if (e.target.parentNode.dataset.piece[0] != game.turn()) {
        draggedPiece.classList.remove("dragging");
        draggedPiece = null;

        if (toggle) {
            recentHighlight.classList.remove("highlighted");
            recentHighlight = null;
            hoveredSquare.classList.remove("hovered");
            hoveredSquare = null;
            clearHints();
            toggle = false;
        }

        return;
    }
}

document.addEventListener("mousemove", (e) => {
    if (draggedPiece) {
        draggedPiece.style.left = e.pageX - offsetX + "px";
        draggedPiece.style.top = e.pageY - offsetY + "px";

        const squares = [...document.querySelectorAll(".square")];
        const dropSquareEl = squares.find((square) => {
            const rect = square.getBoundingClientRect();
            return (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            );
        });

        if (hoveredSquare) {
            hoveredSquare.classList.remove("hovered");
            hoveredSquare = null;
        }
        if (dropSquareEl) {
            dropSquareEl.classList.add("hovered");
            hoveredSquare = dropSquareEl;
        }
    }
});

document.addEventListener("mouseup", (e) => {
    if (draggedPiece) {
        const squares = [...document.querySelectorAll(".square")];
        const dropSquareEl = squares.find((sq) => {
            const r = sq.getBoundingClientRect();
            return (
                e.clientX >= r.left &&
                e.clientX <= r.right &&
                e.clientY >= r.top &&
                e.clientY <= r.bottom
            );
        });

        move(dragStartSquare, dropSquareEl, "q");
    }
});

document.addEventListener("click", (e) => {
    if (
        e.target.classList.contains("piece") ||
        e.target.classList.contains("hint") ||
        promoteSquare
    ) {
        return;
    }

    clearHints();

    if (hoveredSquare) {
        hoveredSquare.classList.remove("hovered");
        hoveredSquare = null;
    }
    if (recentHighlight) {
        recentHighlight.classList.remove("highlighted");
        recentHighlight = null;
    }

    toggle = false;
});

function hint_move(e) {
    var hint = e.target.querySelector("div") || e.target;
    move(dragStartSquare, hint.parentNode, "q");
}

function move(fromEl, toEl, promotion) {
    var from = fromEl.dataset.square;
    var to = toEl.dataset.square;

    // Prevent the move if a pawn needs to be promoted
    if (
        game.get(from).type == "p" &&
        (to[1] == "1" || to[1] == "8") &&
        from != to &&
        !promoteSquare
    ) {
        promoter.style.transform = `translate(${
            toEl.getBoundingClientRect().left -
            promoter.getBoundingClientRect().left -
            8 // Genuinely don't know why but this needs an offset of 8 pixels
        }px, ${to[1] == "1" ? 2 : 376}px)`;
        var promoterClose = document.querySelector(".close-container");
        promoter.insertBefore(
            promoterClose,
            promoter.children[to[1] == "1" ? promoter.childElementCount - 1 : 0]
        );
        //promoterClose.remove();
        promoter.style.display = "block";
        promoteSquare = toEl;
        clearHints();
        return;
    }

    // If an invalid move is attempted, chess.js throws an error
    try {
        var move = game.move({
            from,
            to,
            promotion,
        });
        if (undoneMoves.length > 0) {
            refreshHistoryBoard();
            document.getElementById("redoButton").disabled = true;
        }
        undoneMoves = [];
        gameHistory.push(move);
        localStorage.setItem("game", playerColor + JSON.stringify(gameHistory));

        if (promoteSquare) {
            promoter.style.display = "none";
        }

        recentHighlight = null;
        promoteSquare = null;
        toggle = false;

        for (const square of highlightedSquares) {
            square.classList.remove("highlighted");
        }

        highlightedSquares.push(fromEl, toEl);
        fromEl.classList.add("highlighted");
        toEl.classList.add("highlighted");

        clearHints();

        var row;
        var moveListEl = document.createElement("td");
        moveListEl.innerHTML = move.san;
        moveListEl.dataset.index = gameHistory.length - 1;
        moveListEl.classList.add("move");
        moveListEl.classList.add("highlighted");
        moveListEl.onclick = displayPrevMove;
        historyBoardElems.push(moveListEl);
        if (highlightedMove) {
            highlightedMove.classList.remove("highlighted");
        }
        highlightedMove = moveListEl;
        if (move.color == "w") {
            var row = document.createElement("tr");
            historyBoard.appendChild(row);
        } else row = historyBoard.lastChild;
        row.appendChild(moveListEl);
    } catch (e) {
        if (e.toString().startsWith("Error: Invalid move")) {
            // Converting to string means we don't have to check the type of error
            if (from != to) {
                console.log("Invalid move!");
            } else if (toggle) {
                recentHighlight.classList.remove("highlighted");
                recentHighlight = null;
                hoveredSquare.classList.remove("hovered");
                hoveredSquare = null;
                clearHints();
                toggle = false;
            }
        } else {
            console.error(e);
        }
    }

    if (hoveredSquare) {
        hoveredSquare.classList.remove("hovered");
        hoveredSquare = null;
    }

    // if (draggedPiece) {
    //     draggedPiece.remove();
    // }

    updateDOM(); // Update the entire board instead of just the piece moved to account for moves that affect other squares (e.g. castling and en passant)
    draggedPiece = null;
    if (game.turn() != playerColor) {
        worker.postMessage({type: "calculateMove", fen: game.fen()});
    }
}

const evaluations = {
    p: 10,
    n: 30,
    b: 30,
    r: 50,
    q: 90,
};

function evaluate(update = true) {
    var black = 0;
    var white = 0;
    for (const rank of boardDOM) {
        for (const square of rank) {
            if (
                square.dataset.piece == "null" ||
                square.dataset.piece[1] == "k"
            )
                continue;

            const piece = square.dataset.piece[1];
            const colour = square.dataset.piece[0];

            if (colour == "w") {
                white += evaluations[piece];
            } else {
                black += evaluations[piece];
            }
        }
    }
    black = black == 0 ? 1 : black; // Prevent divide by zero
    white = white == 0 ? 1 : white;
    if (update)
        document.getElementById("blackEval").style.height = `${
            (black / (white + black)) * 830 + 1
        }px`;
    // 1 is added purely for aesthetic reasons, so when it's perfectly equal the bar sits aligned with the center of the board
    else return black / (white + black);
}

function generateHints() {
    var moves = game.moves({
        square: dragStartSquare.dataset.square,
        verbose: true,
    });
    if (moves.length == 0) {
        return;
    }

    for (const move of moves) {
        var targetSquare = move.to;

        var squareElem = document.getElementById(targetSquare);

        if (squareElem.classList.contains("hint")) {
            continue; // Prevents multiple hints on a single square (only really useful for pawn promotion)
        }

        var circle = document.createElement("div");
        circle.classList.add("hint");
        if (move.isCapture() || move.isEnPassant()) {
            circle.classList.add("capture");
        }
        squareElem.classList.add("hint");
        squareElem.appendChild(circle);
        circle.parentNode.onclick = hint_move;
        hints.push(circle);
    }
}

function clearHints() {
    if (hints.length > 0) {
        for (const hint of hints) {
            if (hint) {
                hint.parentNode.classList.remove("hint");
                hint.parentNode.onclick = null;
                hint.remove();
            }
        }
        hints = [];
    }
}

function closePromoter() {
    promoteSquare = null;
    promoter.style.display = "none";
}

function undo() {
    undoneMoves.push(gameHistory.pop());
    game.load(undoneMoves[undoneMoves.length - 1].before);

    updateDOM();

    var index = gameHistory.length;

    if (recentHighlight) {
        recentHighlight.classList.remove("highlighted");
    }

    for (const square of highlightedSquares) {
        square.classList.remove("highlighted");
    }

    if (index == 0) return;

    var prevMove = gameHistory[index - 1];
    var fromEl = document.getElementById(prevMove.from);
    var toEl = document.getElementById(prevMove.to);

    highlightedSquares.push(fromEl, toEl);
    fromEl.classList.add("highlighted");
    toEl.classList.add("highlighted");

    var highlightedIndex = -1;
    if (highlightedMove) {
        highlightedMove.classList.remove("highlighted");
        highlightedIndex = historyBoardElems.indexOf(highlightedMove) - 1;
    }
    if (highlightedIndex >= 0) {
        highlightedMove = historyBoardElems[highlightedIndex];
        highlightedMove.classList.add("highlighted");
    }

    document.getElementById("redoButton").disabled = false;
}

function redo() {
    var move = undoneMoves.pop();
    gameHistory.push(game.move(move));
    var fromEl = document.getElementById(move.from);
    var toEl = document.getElementById(move.to);

    if (recentHighlight) {
        recentHighlight.classList.remove("highlighted");
    }

    for (const square of highlightedSquares) {
        square.classList.remove("highlighted");
    }

    highlightedSquares.push(fromEl, toEl);
    fromEl.classList.add("highlighted");
    toEl.classList.add("highlighted");
    updateDOM();

    var highlightedIndex;
    if (highlightedMove) {
        highlightedMove.classList.remove("highlighted");
        highlightedIndex = historyBoardElems.indexOf(highlightedMove) + 1;
    } else {
        highlightedIndex = 0;
    }
    highlightedMove = historyBoardElems[highlightedIndex];
    highlightedMove.classList.add("highlighted");

    if (highlightedIndex == historyBoardElems.length - 1) {
        document.getElementById("redoButton").disabled = true;
    }
}

function refreshHistoryBoard() {
    historyBoard.innerHTML = "";
    for (const move of gameHistory) {
        var row;
        var moveListEl = document.createElement("td");
        historyBoardElems.push(moveListEl);
        moveListEl.innerHTML = move.san;
        moveListEl.dataset.index = historyBoardElems.indexOf(moveListEl);
        moveListEl.classList.add("move");
        moveListEl.classList.add("highlighted");
        moveListEl.onclick = displayPrevMove;
        if (highlightedMove) {
            highlightedMove.classList.remove("highlighted");
        }
        highlightedMove = moveListEl;
        if (move.color == "w") {
            var row = document.createElement("tr");
            historyBoard.appendChild(row);
        } else row = historyBoard.lastChild;
        row.appendChild(moveListEl);
    }
}

function displayPrevMove(e) {
    var index = parseInt(e.target.dataset.index);

    gameHistory.push(...undoneMoves.toReversed());
    if (index + 1 < gameHistory.length) {
        undoneMoves = gameHistory
            .splice(index + 1, gameHistory.length - 1)
            .toReversed();
    } else {
        undoneMoves = [];
    }

    game.load(gameHistory[gameHistory.length - 1].after);

    e.target.classList.add("highlighted");
    if (highlightedMove) {
        highlightedMove.classList.remove("highlighted");
    }
    highlightedMove = e.target;
    updateDOM();

    if (recentHighlight) {
        recentHighlight.classList.remove("highlighted");
    }

    for (const square of highlightedSquares) {
        square.classList.remove("highlighted");
    }

    var prevMove = gameHistory[gameHistory.length - 1];
    var fromEl = document.getElementById(prevMove.from);
    var toEl = document.getElementById(prevMove.to);

    highlightedSquares.push(fromEl, toEl);
    fromEl.classList.add("highlighted");
    toEl.classList.add("highlighted");
}

var stored = localStorage.getItem("game");
if (stored != null) {
    playerColor = stored[0];
    stored = stored.substring(1);
    if (stored != "") {
        gameHistory = JSON.parse(stored);
        game.load(gameHistory[gameHistory.length - 1].after);
    }
}

init_board();
//game.load("r1bqkbnr/pPppppp1/n7/8/8/7N/1PPPPPpP/RNBQKB1R w KQkq - 2 6"); // Promote black right white left
//game.load("rnbqkb1r/1pppppPp/7n/8/8/N7/PpPPPPP1/R1BQKBNR b KQkq - 2 6");
updateDOM();