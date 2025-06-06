
import express from "express";
import { InfringingContentController } from "../controllers/infringing-content.controller.js";
import { requireAuth, requireAdminOrOwner } from "../middleware/auth.js";

const router = express.Router();
const controller = new InfringingContentController();

// Tất cả routes đều yêu cầu authentication
router.use(requireAuth);

// Routes cho infringing content
router.get("/paginated", controller.getPaginatedInfringingContents.bind(controller));
router.get("/:id", controller.getInfringingContentById.bind(controller));
router.post("/", controller.createInfringingContent.bind(controller));
router.post("/search-and-process", controller.searchAndProcessInfringingContent.bind(controller));
router.put("/:id", controller.updateInfringingContent.bind(controller));
router.delete("/:id", controller.deleteInfringingContent.bind(controller));

export { router as infringingContentRouter };
