"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doRpc = void 0;
// @ts-ignore
const errio_1 = __importDefault(require("errio"));
const standard_as_callback_1 = __importDefault(require("standard-as-callback"));
const utils_1 = require("./utils");
function doRpc(socket, options, method, args) {
    const dataOnlyArgs = args;
    let callback;
    if ((0, utils_1.endsWithCallback)(args)) {
        callback = dataOnlyArgs.pop();
    }
    const promise = new Promise((resolve, reject) => {
        socket.send(options, method, dataOnlyArgs, (err, result) => {
            if (err) {
                reject(errio_1.default.parse(err));
            }
            else {
                resolve(result);
            }
        });
    });
    return (0, standard_as_callback_1.default)(promise, callback);
}
exports.doRpc = doRpc;
