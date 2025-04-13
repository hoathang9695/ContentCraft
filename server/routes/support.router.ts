
import express from "express";
import { SupportController } from "../controllers/support.controller";
import { isAuthenticated } from "../middleware/auth";

const router = express.Router();
const supportController = new SupportController();

router.get("/", isAuthenticated, supportController.getAllSupportRequests);
router.put("/:id", isAuthenticated, supportController.updateSupportRequest);
router.put("/:id/assign", isAuthenticated, supportController.assignSupportRequest);

export default router;
