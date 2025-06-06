
import { Request, Response } from "express";
import { storage } from "../storage";
import { insertInfringingContentSchema } from "@shared/schema";
import { ZodError } from "zod";
import Redis from "ioredis";

export class InfringingContentController {
  // Get paginated infringing contents with date filters
  async getPaginatedInfringingContents(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user as Express.User;
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;
      const searchQuery = req.query.search as string;

      console.log("Paginated infringing contents request:", {
        user: { id: user.id, role: user.role },
        page,
        limit,
        startDate,
        endDate,
        searchQuery
      });

      // Get paginated data from storage
      const result = await storage.getPaginatedInfringingContents({
        userId: user.id,
        userRole: user.role,
        page,
        limit,
        startDate,
        endDate,
        searchQuery
      });

      console.log(`Returning paginated infringing contents: ${result.data.length} items of ${result.total} total`);

      return res.json(result);
    } catch (error) {
      console.error("Error fetching paginated infringing contents:", error);
      return res.status(500).json({
        message: "Error fetching paginated infringing contents",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Get infringing content by ID
  async getInfringingContentById(req: Request, res: Response) {
    try {
      const contentId = Number(req.params.id);
      const content = await storage.getInfringingContent(contentId);
      const user = req.user as Express.User;

      if (!content) {
        return res.status(404).json({ message: "Infringing content not found" });
      }

      if (user.role !== "admin" && content.assigned_to_id !== user.id) {
        return res
          .status(403)
          .json({ message: "You can only view infringing content assigned to you" });
      }

      console.log("Infringing content fetched:", content);
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Error fetching infringing content" });
    }
  }

  // Create new infringing content
  async createInfringingContent(req: Request, res: Response) {
    try {
      const user = req.user as Express.User;
      let assigned_to_id = user.id;

      if (user.role === "admin" && req.body.assigned_to_id) {
        assigned_to_id = req.body.assigned_to_id;
      }

      console.log("Creating new infringing content with data:", {
        userId: user.id,
        username: user.username,
        role: user.role,
        requestBody: req.body,
      });

      const inputData = {
        ...req.body,
        assigned_to_id: Number(assigned_to_id),
      };

      if (isNaN(inputData.assigned_to_id)) {
        return res.status(400).json({
          message: "Invalid assigned_to_id value",
          value: req.body.assigned_to_id,
        });
      }

      const validatedData = insertInfringingContentSchema.parse(inputData);
      const newContent = await storage.createInfringingContent(validatedData);
      return res.status(201).json(newContent);
    } catch (error) {
      console.error("Error creating infringing content:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      return res.status(500).json({
        message: "Error creating infringing content",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Update infringing content
  async updateInfringingContent(req: Request, res: Response) {
    try {
      console.log("Update infringing content request:", {
        body: req.body,
        params: req.params,
        user: req.user
          ? {
              id: (req.user as Express.User).id,
              role: (req.user as Express.User).role,
            }
          : null,
      });

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized - Please log in",
        });
      }

      const contentId = Number(req.params.id);
      if (!contentId || isNaN(contentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid infringing content ID",
        });
      }

      const existingContent = await storage.getInfringingContent(contentId);
      const user = req.user as Express.User;

      console.log("Existing infringing content:", existingContent);

      if (!existingContent) {
        return res.status(404).json({ message: "Infringing content not found" });
      }

      if (existingContent.assigned_to_id !== user.id && user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "You can only edit infringing content assigned to you" });
      }

      // Parse và validate input data
      const inputData = {
        ...req.body,
        updated_at: new Date(),
      };

      // Thêm thời gian xử lý khi hoàn thành
      if (inputData.status === "completed" && !inputData.processing_time) {
        inputData.processing_time = new Date();
      }

      console.log("Processed input data:", inputData);

      // Validate data
      const validatedData = insertInfringingContentSchema.partial().parse(inputData);

      console.log("Validated infringing content data:", validatedData);

      const updatedContent = await storage.updateInfringingContent(
        contentId,
        validatedData,
      );

      if (!updatedContent) {
        console.error("No infringing content returned after update");
        return res.status(500).json({
          success: false,
          message: "Failed to update infringing content",
        });
      }

      console.log("Infringing content updated successfully:", updatedContent);

      return res.json({
        success: true,
        data: updatedContent,
      });
    } catch (error) {
      console.error("Error in update infringing content controller:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      return res.status(500).json({
        success: false,
        message: "Error updating infringing content",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Search and process infringing content
  async searchAndProcessInfringingContent(req: Request, res: Response) {
    try {
      console.log("🔍 [STEP 1] Starting infringing content processing request");
      
      if (!req.user) {
        console.log("❌ [STEP 1] Unauthorized - No user in request");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user as Express.User;
      const { externalId, violationDescription } = req.body;

      console.log("✅ [STEP 1] User authenticated:", {
        userId: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      });

      if (!externalId || !violationDescription) {
        console.log("❌ [STEP 1] Missing required fields:", {
          externalId: !!externalId,
          violationDescription: !!violationDescription
        });
        return res.status(400).json({ 
          message: "External ID và mô tả vi phạm là bắt buộc" 
        });
      }

      console.log("✅ [STEP 2] Request validation passed:", {
        externalId,
        violationDescription,
        descriptionLength: violationDescription.length
      });

      // Create infringing content record with pending status
      console.log("🔍 [STEP 3] Creating infringing content record in database...");
      
      const newContent = await storage.createInfringingContent({
        externalId: externalId,
        assigned_to_id: user.id,
        processing_time: null, // Will be set when completed
        violation_description: violationDescription,
        status: "pending"
      });

      console.log("✅ [STEP 3] Database record created successfully:", {
        recordId: newContent.id,
        externalId: newContent.externalId,
        assignedTo: newContent.assigned_to_id,
        status: newContent.status,
        createdAt: newContent.createdAt
      });

      // Try to connect to Redis and delete the key
      let redisDeleteSuccess = false;
      let redisError = null;
      let deletedKeysCount = 0;
      let foundKeysCount = 0;

      console.log("🔍 [STEP 4] Starting Redis connection and key deletion process...");

      try {
        // Check for Redis connection configuration in environment
        const redisHost = process.env.REDISEARCH_HOST;
        const redisPort = process.env.REDISEARCH_PORT;
        const redisPassword = process.env.REDISEARCH_PASSWORD;
        
        console.log("🔍 [STEP 4.1] Checking Redis environment variables:", {
          redisHost: redisHost ? `${redisHost}` : "NOT_FOUND",
          redisPort: redisPort ? `${redisPort}` : "NOT_FOUND",
          redisPassword: redisPassword ? "***CONFIGURED***" : "NOT_FOUND"
        });
        
        if (!redisHost || !redisPort || !redisPassword) {
          console.warn("❌ [STEP 4.1] Redis configuration incomplete");
          redisError = "Redis configuration not complete";
        } else {
          console.log("✅ [STEP 4.1] Redis configuration found, creating connection...");
          
          const redis = new Redis({
            host: redisHost,
            port: parseInt(redisPort),
            password: redisPassword,
            connectTimeout: 3000, // 3 seconds timeout for production
            lazyConnect: true,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 1
          });
          
          console.log("🔍 [STEP 4.2] Attempting Redis connection...");
          // Try to connect with timeout
          await redis.connect();
          console.log("✅ [STEP 4.2] Redis connection established successfully");
          
          // Search for the key pattern
          const searchPattern = `*${externalId}*`;
          console.log("🔍 [STEP 4.3] Searching for keys with pattern:", searchPattern);
          
          const keys = await redis.keys(searchPattern);
          foundKeysCount = keys.length;
          
          console.log(`✅ [STEP 4.3] Found ${foundKeysCount} keys matching pattern`);
          
          if (keys.length > 0) {
            console.log("🔍 [STEP 4.4] Deleting found keys...");
            console.log("Keys to delete:", keys.slice(0, 5).join(", ") + (keys.length > 5 ? ` ... and ${keys.length - 5} more` : ""));
            
            // Delete all matching keys
            const deleteResult = await redis.del(...keys);
            deletedKeysCount = deleteResult;
            console.log(`✅ [STEP 4.4] Successfully deleted ${deleteResult} keys from Redis`);
            redisDeleteSuccess = deleteResult > 0;
          } else {
            console.log(`✅ [STEP 4.4] No keys found - considering as success (nothing to delete)`);
            redisDeleteSuccess = true; // Consider as success if no keys found
          }
          
          console.log("🔍 [STEP 4.5] Closing Redis connection...");
          await redis.disconnect();
          console.log("✅ [STEP 4.5] Redis connection closed successfully");
        }
      } catch (error) {
        console.error("❌ [STEP 4] Redis operation failed:", error);
        redisError = error instanceof Error ? error.message : String(error);
      }

      // Update status based on Redis operation result
      console.log("🔍 [STEP 5] Updating database record status based on Redis result...");
      
      const finalStatus = redisDeleteSuccess ? "completed" : "processing";
      const processingTime = redisDeleteSuccess ? new Date() : null;

      console.log("🔍 [STEP 5.1] Status update details:", {
        finalStatus,
        processingTime,
        redisDeleteSuccess,
        foundKeysCount,
        deletedKeysCount
      });

      const updatedContent = await storage.updateInfringingContent(newContent.id, {
        status: finalStatus,
        processing_time: processingTime
      });

      console.log("✅ [STEP 5] Database record updated successfully:", {
        recordId: updatedContent.id,
        finalStatus: updatedContent.status,
        processingTime: updatedContent.processing_time,
        updatedAt: updatedContent.updated_at
      });

      const responseData = {
        success: true,
        data: updatedContent,
        redis: {
          success: redisDeleteSuccess,
          error: redisError,
          foundKeys: foundKeysCount,
          deletedKeys: deletedKeysCount
        },
        message: redisDeleteSuccess 
          ? `Đã xử lý thành công và xóa ${deletedKeysCount} nội dung vi phạm từ Redis`
          : "Đã tạo yêu cầu xử lý, nhưng không thể kết nối Redis"
      };

      console.log("✅ [STEP 6] Sending successful response:", {
        success: responseData.success,
        recordId: responseData.data.id,
        redisSuccess: responseData.redis.success,
        message: responseData.message
      });

      return res.json(responseData);

    } catch (error) {
      console.error("❌ [ERROR] Error in searchAndProcessInfringingContent:", error);
      if (error instanceof ZodError) {
        console.error("❌ [ERROR] Validation error details:", error.errors);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }
      return res.status(500).json({
        success: false,
        message: "Error processing infringing content",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Delete infringing content
  async deleteInfringingContent(req: Request, res: Response) {
    try {
      const contentId = Number(req.params.id);
      const existingContent = await storage.getInfringingContent(contentId);
      const user = req.user as Express.User;

      if (!existingContent) {
        return res.status(404).json({ message: "Infringing content not found" });
      }

      if (user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only administrators can delete infringing content" });
      }

      const deleted = await storage.deleteInfringingContent(contentId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Error deleting infringing content" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error deleting infringing content" });
    }
  }
}
