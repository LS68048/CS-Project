import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const game = new Chess();

self.onmessage = function (event) {
    this.postMessage ({type:"log", message:"Received"})
    const { type, fen } = event.data;
    game.load(fen);

    if (type == "calculateMove") {
        fillTree();
        const moveToPerform = rootNode.children[0].move;
        postMessage({ type: "moveTime", moveToPerform });
    }
};

class MoveTreeNode {
    constructor(move) {
        this.move = move;
        this.eval = 0;
        this.children = [];
    }
}

var rootNode;

function fillTree() {
    rootNode = new MoveTreeNode(game.fen());
    for (const move of game.moves({ verbose: true })) {
        rootNode.children.push(new MoveTreeNode(move));
    }
    FindBestMove(rootNode, 4);
}

function FindBestMove(node, depth, root = false) {
    for (const child of node.children) {
        if (depth > 1) {
            game.move(child.move);
            for (const move of game.moves({ verbose: true })) {
                child.children.push(new MoveTreeNode(move));
            }
            FindBestMove(child, depth - 1);
            if (child.move.color == playerColor)
                child.eval = Math.min(
                    ...child.children.map((childChild) => childChild.eval)
                );
            else
                child.eval = Math.max(
                    ...child.children.map((childChild) => childChild.eval)
                );
            game.undo();
        } else {
            child.eval = evaluate(child.move);
        }
    }
    if (root) {
        root.children.reduce((highestEval, currentMove) => {
            return currentMove.eval > highestEval.value
                ? currentMove
                : highestEval;
        });
    }
}