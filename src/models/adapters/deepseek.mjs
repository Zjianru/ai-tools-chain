import {
    handleReview
} from "../deepseek/review.mjs";
import {
    handleSecondOpinion
} from "../deepseek/secondOpinion.mjs";
import {
    handleCodegen
} from "../deepseek/codegen.mjs";
import {
    handlePlanReview
} from "../deepseek/planReview.mjs";
import {
    handlePlanningMeeting
} from "../deepseek/planningMeeting.mjs";
import {
    handleReviewMeeting
} from "../deepseek/reviewMeeting.mjs";
import {
    handlePlanning
} from "../deepseek/planning.mjs";
import {
    handlePlanningProductPlanner,
    handlePlanningSystemDesigner,
    handlePlanningSeniorDeveloper,
    handlePlanningTestPlanner,
    handlePlanningRiskPlanner
} from "../deepseek/planningRoles.mjs";

export const deepseekAdapter = {
    async invoke(role, payload, { step, aiDir }) {
        const apiKeyEnv = step.apiKeyEnv || step.api_key_env || "DEEPSEEK_API_KEY";
        const apiKey = process.env[apiKeyEnv];
        const model = step.model || "deepseek-chat";

        if (role === "review") {
            return await handleReview({ apiKey, model, aiDir, payload });
        }
        if (role === "second_opinion") {
            return await handleSecondOpinion({ apiKey, model, aiDir, payload });
        }
        if (role === "codegen") {
            return await handleCodegen({ apiKey, model, aiDir, payload });
        }
        if (role === "plan_review") {
            return await handlePlanReview({ apiKey, model, aiDir, payload });
        }
        if (role === "planning_meeting") {
            return await handlePlanningMeeting({ apiKey, model, aiDir, payload });
        }
        if (role === "review_meeting") {
            return await handleReviewMeeting({ apiKey, model, aiDir, payload });
        }
        if (role === "planning") {
            return await handlePlanning({ apiKey, model, aiDir, payload });
        }
        if (role === "planning_product_planner") {
            return await handlePlanningProductPlanner({ apiKey, model, aiDir, payload });
        }
        if (role === "planning_system_designer") {
            return await handlePlanningSystemDesigner({ apiKey, model, aiDir, payload });
        }
        if (role === "planning_senior_developer") {
            return await handlePlanningSeniorDeveloper({ apiKey, model, aiDir, payload });
        }
        if (role === "planning_test_planner") {
            return await handlePlanningTestPlanner({ apiKey, model, aiDir, payload });
        }
        if (role === "planning_risk_planner") {
            return await handlePlanningRiskPlanner({ apiKey, model, aiDir, payload });
        }

        return { ok: false };
    }
};
