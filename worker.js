import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const game = new Chess();

var color;
var num = 0;

self.onmessage = function (event) {
    var { type, colour, move, difficulty } = event.data;
    difficulty = parseInt(difficulty)
    color = colour;

    if (type == "calculateMove") {
        if (move == null) {
            move = {
                after: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            };
        }
        rootNode = new MoveTreeNode(move);
        var depth = 4;
        //rootNode = fillTree(rootNode, depth);
        num = 0;
        rootNode = alphabeta(rootNode, depth, -Infinity, Infinity, true);

        var moveToPerform;
        const third = Math.floor(rootNode.children.length/3);

        if (difficulty == 4) {
            const bestScore = Math.max(
                ...rootNode.children.map((node) => node.eval)
            );
            rootNode.children = rootNode.children.filter(
                (node) => node.eval === bestScore
            );

            moveToPerform =
                rootNode.children[
                    Math.floor(Math.random() * rootNode.children.length)
                ].move;
        }
        else if (difficulty > 0) {
            moveToPerform = rootNode.children[Math.floor(Math.random()) * third + (difficulty - 1) * third].move
        }
        else {
            const worstScore = Math.min(
                ...rootNode.children.map((node) => node.eval)
            );

            rootNode.children = rootNode.children.filter(
                (node) => node.eval === worstScore
            );

            moveToPerform =
                rootNode.children[
                    Math.floor(Math.random() * rootNode.children.length)
                ].move;
        }
        postMessage({ type: "moveTime", moveToPerform });
    }
};

class MoveTreeNode {
    constructor(move) {
        this.move = move;
        this.eval = undefined;
        this.children = [];
        this.parent = null;
    }
}

var rootNode;

function fillTree(node, depth) {
    num += 1;
    postMessage({ type: "searchCount", num });
    game.load(node.move.after);
    for (const move of game.moves({ verbose: true })) {
        var child = new MoveTreeNode(move);
        child.parent = node;

        if (depth > 0 && !game.isGameOver()) child = fillTree(child, depth - 1);

        node.children.push(child);
    }
    return node;
}

function alphabeta(node, depth, alpha, beta, maximizingPlayer) {
    num += 1;
    postMessage({ type: "searchCount", num });
    game.load(node.move.after);

    if (depth == 0 || game.isGameOver()) {
        node.eval = evaluate(node.move, color); // Store the evaluation on the node
        return node;
    }

    if (maximizingPlayer) {
        let value = -Infinity;

        for (const move of game.moves({ verbose: true })) {
            var child = new MoveTreeNode(move);
            child.parent = node;

            node.children.push(child);
            const childNode = alphabeta(child, depth - 1, alpha, beta, false);

            value = Math.max(childNode.eval, value);

            alpha = Math.max(alpha, value);
            if (alpha >= beta) {
                //node.children.splice(node.children.indexOf(child), 1); // CULL THE WEAK!!!
                break; // Beta cutoff (pruning)
            }
        }

        node.eval = value; // Update the current node's evaluation
        return node;
    } else {
        let value = Infinity;

        for (const move of game.moves({ verbose: true })) {
            var child = new MoveTreeNode(move);
            child.parent = node;

            node.children.push(child);
            const childNode = alphabeta(child, depth - 1, alpha, beta, true);

            value = Math.min(childNode.eval, value);

            beta = Math.min(beta, value);
            if (alpha >= beta) {
                //node.children.splice(node.children.indexOf(child), 1);
                break; // Alpha cutoff (pruning)
            }
        }

        node.eval = value; // Update the current node's evaluation
        return node;
    }
}

const evaluations = {
    p: 10,
    n: 30,
    b: 30,
    r: 50,
    q: 100,
};

function evaluate(move, color) {
    var score = 0;
    game.load(move.after);
    var board = game.board();

    if (move.captured != undefined)
        score += evaluations[move.captured] * (game.turn() == color ? -1 : 1);
    if (game.isCheckmate())
        score +=
            1000 *
            (color == game.turn()
                ? -1
                : 1); // Checkmate is really bad or really good
    else if (game.isGameOver()) score -= 1000; // We want to WIN

    for (const i of board) {
        for (const square of i) {
            if (square == null) continue;
            if (square.type == "k") continue;

            score +=
                evaluations[square.type] * (color == square.color ? -1 : 1);
        }
    }

    return score;
}
