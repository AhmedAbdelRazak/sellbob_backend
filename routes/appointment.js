// routes/appointment.js

const express = require("express");
const router = express.Router();

const appointmentController = require("../controllers/appointment");

// CREATE
router.post("/appointments", appointmentController.createAppointment);

// READ (with optional filters/pagination)
router.get("/appointments", appointmentController.getAppointments);

// READ single
router.get("/appointments/:id", appointmentController.getAppointmentById);

// UPDATE
router.put("/appointments/:id", appointmentController.updateAppointment);

// DELETE
router.delete("/appointments/:id", appointmentController.deleteAppointment);

module.exports = router;
