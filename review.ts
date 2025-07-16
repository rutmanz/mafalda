#!/usr/bin/env node

import { exec } from "child_process";

const me = "rutmanz";

type ReviewState = "CHANGES_REQUESTED" | "COMMENTED" | "APPROVED";
type CheckState = "PASS" | "FAIL" | "PENDING";
interface Pr {
    author: {
        id: string;
        is_bot: boolean;
        login: string;
        name: string;
    };
    title: string;
    number: number;
    reviews: {
        id: string;
        author: {
            login: string;
        };
        authorAssociation: "MEMBER";
        body: string;
        submittedAt: string;
        includesCreatedEdit: boolean;
        reactionGroups: string[];
        state: ReviewState;
        commit: {
            oid: string;
        };
    }[];
    reviewRequests: {
        __typename: "User";
        login: string;
    }[];
    state: "OPEN" | "MERGED" | "CLOSED";
    headRefOid: string;
    updatedAt: string;
    createdAt: string;
    reviewDecision:
        | "REVIEW_REQUIRED"
        | "CHANGES_REQUESTED"
        | "APPROVED"
        | "MY_REVIEW_REQUIRED"
        | "DRAFT"; // not really fix later
    mergeStateStatus: "DIRTY" | "BLOCKED" | "BEHIND" | "UNKNOWN";
    statusCheckRollup: {
        __typename: "CheckRun";
        conclusion: "FAILURE" | "SUCCESS" | "NEUTRAL" | null;
        status: "COMPLETED" | "PENDING" | null;
        name: string;
    }[];
    mergedAt: string | null;
    closedAt: string | null;
    isDraft: boolean;
}

const colorMsg = {
    APPROVED: "\x1b[32mAPPROVED\x1b[0m",
    CHANGES_REQUESTED: "\x1b[31mCHANGES_REQUESTED\x1b[0m",
    CURRENT: "\x1b[34mCURRENT\x1b[0m",
    STANDING: "\x1b[34mSTANDING\x1b[0m",
    OUTDATED: "\x1b[33mOUTDATED\x1b[0m",
    REQUESTED: "\x1b[90mREQUESTED\x1b[0m",
    COMMENTED: "\x1b[90mCOMMENTED\x1b[0m",

    DIRTY: "\x1b[31mCONFLICTS\x1b[0m",
    BEHIND: "\x1b[34mBEHIND\x1b[0m",
    BLOCKED: "\x1b[32mCLEAN\x1b[0m",

    PASS: "\x1b[32mPASSING\x1b[0m",
    FAIL: "\x1b[31mFAILING\x1b[0m",
    PENDING: "\x1b[33mPENDING\x1b[0m",
} as const;

const decisionColors = {
    APPROVED: "\x1b[42m",
    CHANGES_REQUESTED: "\x1b[41m",
    REVIEW_REQUIRED: "\x1b[43m",
    MY_REVIEW_REQUIRED: "\x1b[45m",
    DRAFT: "\x1b[100m",
} as const;

class ReviewStatus {
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
            output += colorMsg[this.state];
        } else if (this.requested) {
            output += colorMsg.REQUESTED.padEnd(25);
        }
        if (this.state == "COMMENTED") {
            output = output + colorMsg.COMMENTED;
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
}
exec(
    "gh pr list --json author,reviews,number,state,headRefOid,reviewRequests,title,updatedAt,createdAt,reviewDecision,mergeStateStatus,statusCheckRollup,state,mergedAt,isDraft,closedAt --state open",
    (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Command stderr: ${stderr}`);
        }
        const prs: Pr[] = JSON.parse(stdout.toString());
        const myReviews: { pr: Pr; review: ReviewStatus }[] = [];
        prs.sort(
            (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
        )
            .sort(
                (a, b) =>
                    (a.author.login == me ? 1 : 0) -
                    (b.author.login == me ? 1 : 0),
            )
            .forEach((pr) => {
                const reviews: Record<string, ReviewStatus> = {};
                pr.reviewRequests.forEach((req) => {
                    if (req.__typename != "User") return;
                    reviews[req.login] ??= new ReviewStatus(req.login);
                    reviews[req.login].requested = true;
                });
                pr.reviews
                    .sort(
                        (a, b) =>
                            new Date(a.submittedAt).getTime() -
                            new Date(b.submittedAt).getTime(),
                    )

                    .forEach((review) => {
                        if (
                            review.state != "COMMENTED" ||
                            reviews[review.author.login] == null
                        ) {
                            reviews[review.author.login] ??= new ReviewStatus(
                                review.author.login,
                            );
                            reviews[review.author.login].state = review.state;
                            reviews[review.author.login].stale =
                                review.commit.oid != pr.headRefOid;
                            reviews[review.author.login].lastUpdate = new Date(
                                review.submittedAt,
                            ).getTime();
                        }
                    });
                const myReview = Object.values(reviews).find(
                    (review) => review.user == me,
                );

                const activeFailure = Object.values(reviews).some(
                    (review) =>
                        review.state == "CHANGES_REQUESTED" &&
                        !review.requested,
                );
                const needsMe = myReview?.requested ?? false;
                if (
                    !activeFailure &&
                    pr.reviewDecision == "CHANGES_REQUESTED"
                ) {
                    pr.reviewDecision = "REVIEW_REQUIRED";
                }
                if (needsMe) {
                    pr.reviewDecision = "MY_REVIEW_REQUIRED";
                }
                if (pr.isDraft) {
                    pr.reviewDecision = "DRAFT";
                }

                const anyPending = pr.statusCheckRollup.some(
                    (s) => s.status == "PENDING",
                );
                const anyFail = pr.statusCheckRollup.some(
                    (s) => s.status == "COMPLETED" && s.conclusion == "FAILURE",
                );
                const checkStatus: CheckState = anyFail
                    ? "FAIL"
                    : anyPending
                      ? "PENDING"
                      : "PASS";

                const title = `${decisionColors[pr.reviewDecision]}${
                    pr.author.login == me ? "\x1b[1m⭐︎" : ""
                }${pr.number} | ${pr.title}\x1b[0m`;
                console.log(title);
                console.log(
                    "  " +
                        colorMsg[pr.mergeStateStatus] +
                        "  " +
                        colorMsg[checkStatus],
                );

                if (myReview) {
                    myReviews.push({ pr, review: myReview });
                }
                Object.values(reviews)
                    .sort((a, b) => b.lastUpdate - a.lastUpdate)
                    .forEach((r) => {
                        console.log("    " + r.toString());
                    });
            });

        console.log("\n====== MY REVIEWS =======");
        myReviews.map(({ review, pr }) => {
            console.log(
                review.getStateString().padEnd(52, " ") +
                    `\x1b[35m#${pr.number} | ${pr.title}\x1b[0m`,
            );
        });

        // console.log("\n====== RECENTLY CLOSED =======");
        // prs.filter(
        //     (pr) =>
        //         pr.state == "MERGED" &&
        //         Date.now() - new Date(pr.mergedAt!).getTime() <
        //             1000 * 60 * 60 * 12,
        // ).map((pr) => {
        //     console.log(`\x1b[45m#${pr.number} | ${pr.title}\x1b[0m`);
        // });
        // prs.filter(
        //     (pr) =>
        //         pr.state == "CLOSED" &&
        //         Date.now() - new Date(pr.closedAt!).getTime() <
        //             1000 * 60 * 60 * 12,
        // ).map((pr) => {
        //     console.log(`\x1b[45m#${pr.number} | ${pr.title}\x1b[0m`);
        // });
    },
);
