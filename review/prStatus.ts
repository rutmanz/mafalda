import { CheckStatus, decisionColors, MergabilityStatus } from "./colors";
import { me } from "./const";
import { ReviewStatus } from "./reviewStatus";
import { CheckState, Pr } from "./types";

export enum ReviewDecision {
    CHANGES_REQUESTED,
    APPROVED,
    REVIEW_REQUIRED,
    MY_REVIEW_REQUIRED,
    DRAFT,
}
export class PrStatus {
    data: Pr;
    reviewMap: Record<string, ReviewStatus>;
    constructor(data: Pr) {
        this.data = data;
    }

    get createdAt() {
        return new Date(this.data.createdAt);
    }

    get isMine() {
        return this.data.author.login == me;
    }

    reviewFrom(reviewer: string) {
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

    get reviewDecision(): ReviewDecision {
        if (
            !this.waitingOnAuthor &&
            this.data.reviewDecision == "CHANGES_REQUESTED"
        )
            return ReviewDecision.REVIEW_REQUIRED;
        if (this.needsMyReview) return ReviewDecision.MY_REVIEW_REQUIRED;
        if (this.data.isDraft) return ReviewDecision.DRAFT;
        if (this.data.reviewDecision == "APPROVED")
            return ReviewDecision.APPROVED;
        if (this.data.reviewDecision == "CHANGES_REQUESTED")
            return ReviewDecision.CHANGES_REQUESTED;
        return ReviewDecision.REVIEW_REQUIRED;
    }

    get ciStatus(): CheckStatus {
        if (
            this.data.statusCheckRollup.some(
                (s) => s.status == "COMPLETED" && s.conclusion == "FAILURE",
            )
        ) {
            return CheckStatus.FAIL;
        }
        if (this.data.statusCheckRollup.some((s) => s.status == "PENDING"))
            return CheckStatus.PENDING;
        return CheckStatus.PASS;
    }

    get prettyCiStatus(): string {
        switch (this.ciStatus) {
            case CheckStatus.PASS:
                return "\x1b[32mPASSING\x1b[0m";
            case CheckStatus.FAIL:
                return "\x1b[31mFAILING\x1b[0m";
            case CheckStatus.PENDING:
                return "\x1b[33mPENDING\x1b[0m";
        }
    }

    get mergabilityStatus(): MergabilityStatus {
        switch (this.data.mergeStateStatus) {
            case "DIRTY":
                return MergabilityStatus.CONFLICTS;
            case "BEHIND":
                return MergabilityStatus.BEHIND;
            case "BLOCKED":
                return MergabilityStatus.CLEAN;
            default:
                return MergabilityStatus.CLEAN;
        }
    }
    get prettyMergabilityStatus(): string {
        switch (this.mergabilityStatus) {
            case MergabilityStatus.CONFLICTS:
                return "\x1b[31mCONFLICTS\x1b[0m";
            case MergabilityStatus.BEHIND:
                return "\x1b[34mBEHIND\x1b[0m";
            case MergabilityStatus.CLEAN:
                return "\x1b[32mCLEAN\x1b[0m";
        }
    }

    get prettyTitle() {
        return `${decisionColors[this.reviewDecision]} ${
            this.data.author.login == me ? "\x1b[1m⭐︎" : ""
        }${this.data.number} | ${this.data.title} \x1b[0m`;
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
            if (
                this.reviewMap[review.author.login] != null &&
                this.reviewMap[review.author.login].lastUpdate >
                    new Date(review.submittedAt).getTime()
            ) {
                return;
            }

            if (
                review.state != "COMMENTED" ||
                this.reviewMap[review.author.login] == null
            ) {
                const reviewStatus = this.reviewFrom(review.author.login);
                reviewStatus.state = review.state;
                reviewStatus.stale = review.commit.oid != this.data.headRefOid;
                reviewStatus.lastUpdate = new Date(
                    review.submittedAt,
                ).getTime();
            }
        });
    }
}
