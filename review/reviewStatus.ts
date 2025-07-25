import { colorMsg } from "./colors";
import { me } from "./const";
import { ReviewState } from "./types";

export class ReviewStatus {
    user: string;
    state?: ReviewState;
    stale: boolean = false;
    requested: boolean = false;
    lastUpdate: number = 0;
    constructor(user: string) {
        this.user = user;
    }
    getStateString() {
        let output = "";
        if (this.state && this.state != "COMMENTED") {
            output +=
                colorMsg[
                    this.requested
                        ? "OUTDATED"
                        : this.stale
                          ? "STANDING"
                          : "CURRENT"
                ].padEnd(25);
            output += colorMsg[this.state] ?? this.state;
        } else if (this.requested) {
            output += colorMsg.REQUESTED.padEnd(25);
        }
        if (this.state == "COMMENTED") {
            output = output + colorMsg.COMMENTED + "\x1b[34m\x1b[0m";
        }
        return output;
    }
    toString() {
        let output = this.user.padEnd(18, " ");
        if (this.user == me) {
            output = `\x1b[35m${output}\x1b[35m`;
        }
        output += this.getStateString();
        return output;
    }

    get waitingOnAuthor() {
        return this.state == "CHANGES_REQUESTED" && !this.requested;
    }
    get isMine() {
        return this.user == me;
    }
}
