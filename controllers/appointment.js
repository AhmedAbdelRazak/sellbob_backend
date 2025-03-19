// controllers/appointment.js

const Appointment = require("../models/appointment");
const PropertyDetails = require("../models/property_details");
const mongoose = require("mongoose");
const { appointmentConfirmation, appointmentUpdate } = require("./assets");

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Create a new appointment
exports.createAppointment = async (req, res) => {
	try {
		const newAppointment = new Appointment(req.body);
		await newAppointment.save();

		// 1. If there's a propertyId, fetch the property details
		let property = null;
		if (newAppointment.propertyId) {
			property = await PropertyDetails.findById(newAppointment.propertyId);
		}

		// 2. Build Google Maps URL if valid coordinates
		let googleMapsUrl = "#";
		if (
			property &&
			property.location &&
			Array.isArray(property.location.coordinates) &&
			property.location.coordinates.length === 2 &&
			(property.location.coordinates[0] !== 0 ||
				property.location.coordinates[1] !== 0)
		) {
			const [longitude, latitude] = property.location.coordinates;
			// Google expects ?query=lat,long
			googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
		}

		// 3. Send the new appointment confirmation email
		//    Choose your "to" email. For example:
		//    - newAppointment.email (client’s email)
		//    - or agent’s email, if you have it
		//    - or an array of recipients
		await sgMail.send({
			to: newAppointment.email || "agent@example.com",
			from: "noreply@jannatbooking.com", // must be a verified sender
			bcc: ["ahmed.abdelrazak@jannatbooking.com"],
			subject: "New Appointment Scheduled",
			html: appointmentConfirmation(newAppointment, property, googleMapsUrl),
		});

		// 4. Return the newly created appointment
		return res.status(201).json(newAppointment);
	} catch (error) {
		console.error("Error creating appointment:", error);
		return res.status(400).json({ error: error.message });
	}
};

// Get appointments with optional filters (date range, etc.)
exports.getAppointments = async (req, res) => {
	try {
		const { filter, page = 1, limit = 10 } = req.query;

		// Convert to number
		const pageNumber = parseInt(page, 10) || 1;
		const pageLimit = parseInt(limit, 10) || 10;

		let query = {};

		// By default, let's return appointments from the last 30 days
		// if no 'filter' is specified, or if you want that as default.
		const now = new Date();
		const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		// Handle some custom filters:
		const startOfToday = new Date();
		startOfToday.setHours(0, 0, 0, 0);

		const startOfYesterday = new Date(startOfToday);
		startOfYesterday.setDate(startOfYesterday.getDate() - 1);

		const endOfYesterday = new Date(startOfToday.getTime() - 1);

		const next7Days = new Date();
		next7Days.setDate(next7Days.getDate() + 7);

		switch (filter) {
			case "today":
				// appointments for "today"
				query.appointmentDate = {
					$gte: startOfToday,
					$lte: new Date(), // or end of today if you prefer
				};
				break;

			case "yesterday":
				// appointments from yesterday
				query.appointmentDate = {
					$gte: startOfYesterday,
					$lte: endOfYesterday,
				};
				break;

			case "next7days":
				query.appointmentDate = {
					$gte: startOfToday,
					$lte: next7Days,
				};
				break;

			case "all":
				// no date constraint
				break;

			default:
				// last 30 days by default
				query.appointmentDate = {
					$gte: thirtyDaysAgo,
					$lte: new Date(),
				};
				break;
		}

		// Perform query + sorting + pagination
		const appointments = await Appointment.find(query)
			.populate({
				path: "propertyId",
				// Choose which fields you want from the property (e.g. propertyName, address, location, etc.)
				select:
					"propertyName propertyAddress propertyCity propertyState location",
			})
			.populate({
				path: "agentId",
				// For user model, pick the fields (e.g. name, email, phone)
				select: "name email phone",
			})
			.populate({
				path: "clientId",
				// For user model, pick the fields (e.g. name, email, phone)
				select: "name email phone",
			})
			.sort({ appointmentDate: 1 }) // sort ascending by date
			.skip((pageNumber - 1) * pageLimit)
			.limit(pageLimit)
			.exec();

		// Optionally get total count for pagination
		const totalCount = await Appointment.countDocuments(query);

		return res.status(200).json({
			data: appointments,
			currentPage: pageNumber,
			totalPages: Math.ceil(totalCount / pageLimit),
			totalCount,
		});
	} catch (error) {
		console.error("Error getting appointments:", error);
		return res.status(400).json({ error: error.message });
	}
};

// Get a single appointment by ID
exports.getAppointmentById = async (req, res) => {
	try {
		const { id } = req.params;
		const appointment = await Appointment.findById(id);
		if (!appointment) {
			return res.status(404).json({ error: "Appointment not found" });
		}
		return res.status(200).json(appointment);
	} catch (error) {
		console.error("Error getting appointment by ID:", error);
		return res.status(400).json({ error: error.message });
	}
};

// Update an appointment
exports.updateAppointment = async (req, res) => {
	try {
		const { id } = req.params;
		const updated = await Appointment.findByIdAndUpdate(id, req.body, {
			new: true,
		});

		if (!updated) {
			return res.status(404).json({ error: "Appointment not found" });
		}

		// 1. If there's a propertyId, fetch property
		let property = null;
		if (updated.propertyId) {
			property = await PropertyDetails.findById(updated.propertyId);
		}

		// 2. Build Google Maps URL
		let googleMapsUrl = "#";
		if (
			property &&
			property.location &&
			Array.isArray(property.location.coordinates) &&
			property.location.coordinates.length === 2 &&
			(property.location.coordinates[0] !== 0 ||
				property.location.coordinates[1] !== 0)
		) {
			const [longitude, latitude] = property.location.coordinates;
			googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
		}

		// 3. Send updated appointment email
		await sgMail.send({
			to: updated.email || "agent@example.com",
			from: "noreply@jannatbooking.com", // must be a verified sender
			bcc: ["ahmed.abdelrazak@jannatbooking.com"],
			subject: "Appointment Updated",
			html: appointmentUpdate({
				appointment: updated,
				property,
				googleMapsUrl,
			}),
		});

		return res.status(200).json(updated);
	} catch (error) {
		console.error("Error updating appointment:", error);
		return res.status(400).json({ error: error.message });
	}
};

// Delete an appointment
exports.deleteAppointment = async (req, res) => {
	try {
		const { id } = req.params;
		const deleted = await Appointment.findByIdAndDelete(id);
		if (!deleted) {
			return res.status(404).json({ error: "Appointment not found" });
		}
		return res.status(200).json({ message: "Appointment deleted" });
	} catch (error) {
		console.error("Error deleting appointment:", error);
		return res.status(400).json({ error: error.message });
	}
};
