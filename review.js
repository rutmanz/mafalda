#!/usr/bin/env node

// review.ts
import { exec } from "child_process";

// review/colors.ts
var colorMsg = {
  APPROVED: "\x1B[32mAPPROVED\x1B[0m",
  CHANGES_REQUESTED: "\x1B[31mCHANGES_REQUESTED\x1B[0m",
  CURRENT: "\x1B[34mCURRENT\x1B[0m",
  STANDING: "\x1B[34mSTANDING\x1B[0m",
  OUTDATED: "\x1B[33mOUTDATED\x1B[0m",
  PENDING: "\x1B[33mPENDING\x1B[0m",
  REQUESTED: "\x1B[90mREQUESTED\x1B[0m",
  COMMENTED: "\x1B[90mCOMMENTED\x1B[0m"
};
var decisionColors = {
  [1 /* APPROVED */]: "\x1B[42m",
  [0 /* CHANGES_REQUESTED */]: "\x1B[41m",
  [2 /* REVIEW_REQUIRED */]: "\x1B[43m",
  [3 /* MY_REVIEW_REQUIRED */]: "\x1B[45m",
  [4 /* DRAFT */]: "\x1B[100m"
};

// review/const.ts
var me = "rutmanz";

// review/reviewStatus.ts
var ReviewStatus = class {
  user;
  state;
  stale = false;
  requested = false;
  lastUpdate = 0;
  constructor(user) {
    this.user = user;
  }
  getStateString() {
    let output = "";
    if (this.state && this.state != "COMMENTED") {
      output += colorMsg[this.requested ? "OUTDATED" : this.stale ? "STANDING" : "CURRENT"].padEnd(25);
      output += colorMsg[this.state] ?? this.state;
    } else if (this.requested) {
      output += colorMsg.REQUESTED.padEnd(25);
    }
    if (this.state == "COMMENTED") {
      output = output + colorMsg.COMMENTED + "\x1B[34m\x1B[0m";
    }
    return output;
  }
  toString() {
    let output = this.user.padEnd(18, " ");
    if (this.user == me) {
      output = `\x1B[35m${output}\x1B[35m`;
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
};

// review/prStatus.ts
var PrStatus = class {
  data;
  reviewMap;
  constructor(data) {
    this.data = data;
  }
  get createdAt() {
    return new Date(this.data.createdAt);
  }
  get isMine() {
    return this.data.author.login == me;
  }
  reviewFrom(reviewer) {
    this.reviewMap[reviewer] ??= new ReviewStatus(reviewer);
    return this.reviewMap[reviewer];
  }
  get reviews() {
    return Object.values(this.reviewMap);
  }
  get waitingOnAuthor() {
    return this.reviews.some((review) => review.waitingOnAuthor);
  }
  get myReview() {
    return this.reviews.find((review) => review.isMine);
  }
  get needsMyReview() {
    return this.myReview?.requested ?? false;
  }
  get reviewDecision() {
    if (!this.waitingOnAuthor && this.data.reviewDecision == "CHANGES_REQUESTED")
      return 2 /* REVIEW_REQUIRED */;
    if (this.needsMyReview) return 3 /* MY_REVIEW_REQUIRED */;
    if (this.data.isDraft) return 4 /* DRAFT */;
    if (this.data.reviewDecision == "APPROVED")
      return 1 /* APPROVED */;
    if (this.data.reviewDecision == "CHANGES_REQUESTED")
      return 0 /* CHANGES_REQUESTED */;
    return 2 /* REVIEW_REQUIRED */;
  }
  get ciStatus() {
    if (this.data.statusCheckRollup.some(
      (s) => s.status == "COMPLETED" && s.conclusion == "FAILURE"
    )) {
      return 1 /* FAIL */;
    }
    if (this.data.statusCheckRollup.some((s) => s.status == "PENDING"))
      return 2 /* PENDING */;
    return 0 /* PASS */;
  }
  get prettyCiStatus() {
    switch (this.ciStatus) {
      case 0 /* PASS */:
        return "\x1B[32mPASSING\x1B[0m";
      case 1 /* FAIL */:
        return "\x1B[31mFAILING\x1B[0m";
      case 2 /* PENDING */:
        return "\x1B[33mPENDING\x1B[0m";
    }
  }
  get mergabilityStatus() {
    switch (this.data.mergeStateStatus) {
      case "DIRTY":
        return 0 /* CONFLICTS */;
      case "BEHIND":
        return 1 /* BEHIND */;
      case "BLOCKED":
        return 2 /* CLEAN */;
      default:
        return 2 /* CLEAN */;
    }
  }
  get prettyMergabilityStatus() {
    switch (this.mergabilityStatus) {
      case 0 /* CONFLICTS */:
        return "\x1B[31mCONFLICTS\x1B[0m";
      case 1 /* BEHIND */:
        return "\x1B[34mBEHIND\x1B[0m";
      case 2 /* CLEAN */:
        return "\x1B[32mCLEAN\x1B[0m";
    }
  }
  get prettyTitle() {
    return `${decisionColors[this.reviewDecision]} ${this.data.author.login == me ? "\x1B[1m\u2B50\uFE0E" : ""}${this.data.number} | ${this.data.title} \x1B[0m`;
  }
  get simpleTitle() {
    return `#${this.data.number} | ${this.data.title}`;
  }
  processReviews() {
    this.reviewMap = {};
    this.data.reviewRequests.forEach((req) => {
      if (req.__typename != "User") return;
      this.reviewFrom(req.login).requested = true;
    });
    this.data.reviews.forEach((review) => {
      if (this.reviewMap[review.author.login] != null && this.reviewMap[review.author.login].lastUpdate > new Date(review.submittedAt).getTime()) {
        return;
      }
      if (review.state != "COMMENTED" || this.reviewMap[review.author.login] == null) {
        const reviewStatus = this.reviewFrom(review.author.login);
        reviewStatus.state = review.state;
        reviewStatus.stale = review.commit.oid != this.data.headRefOid;
        reviewStatus.lastUpdate = new Date(
          review.submittedAt
        ).getTime();
      }
    });
  }
};

// review.ts
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
    const prs = JSON.parse(stdout.toString()).map(
      (pr) => new PrStatus(pr)
    );
    prs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).sort((a, b) => (a.isMine ? 1 : 0) - (b.isMine ? 1 : 0)).forEach((pr) => {
      pr.processReviews();
      console.log(pr.prettyTitle);
      console.log(
        "  " + pr.prettyMergabilityStatus + "  " + pr.prettyCiStatus
      );
      pr.reviews.sort((a, b) => b.lastUpdate - a.lastUpdate).forEach((r) => console.log("    " + r.toString()));
    });
    console.log("\n====== MY REVIEWS =======");
    prs.filter((pr) => pr.myReview != null).map((pr) => {
      console.log(
        pr.myReview.getStateString().padEnd(52, " ") + `\x1B[35m${pr.simpleTitle}\x1B[0m`
      );
    });
    console.log("\n====== MY PRS =======");
    prs.filter((pr) => pr.isMine).map((pr) => {
      console.log(
        `${pr.prettyTitle} ${pr.prettyMergabilityStatus} ${pr.prettyCiStatus}`
      );
    });
  }
);
