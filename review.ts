#!/usr/bin/env node

import { exec } from "child_process";
import { PrStatus } from "./review/prStatus";
import { Pr } from "./review/types";

exec(
    "gh pr list --json author,reviews,number,state,headRefOid,reviewRequests,title,updatedAt,createdAt,reviewDecision,mergeStateStatus,statusCheckRollup,state,mergedAt,isDraft,closedAt --draft=false --state open",
    (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Command stderr: ${stderr}`);
        }
        const prs: PrStatus[] = (JSON.parse(stdout.toString()) as Pr[]).map(
            (pr) => new PrStatus(pr),
        );

        prs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .sort((a, b) => (a.isMine ? 1 : 0) - (b.isMine ? 1 : 0))
            .forEach((pr) => {
                pr.processReviews()
                console.log(pr.prettyTitle);
                console.log(
                    "  " +
                        pr.prettyMergabilityStatus +
                        "  " +
                        pr.prettyCiStatus,
                );

                pr.reviews
                    .sort((a, b) => b.lastUpdate - a.lastUpdate)
                    .forEach((r) => console.log("    " + r.toString()));
            });

        console.log("\n====== MY REVIEWS =======");
        prs.filter((pr) => pr.myReview != null).map((pr) => {
            console.log(
                pr.myReview!.getStateString().padEnd(52, " ") +
                    `\x1b[35m${pr.simpleTitle}\x1b[0m`,
            );
        });

        console.log("\n====== MY PRS =======");
        prs.filter((pr) => pr.isMine).map((pr) => {
            console.log(
                `${pr.prettyTitle} ${pr.prettyMergabilityStatus} ${pr.prettyCiStatus}`,
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
