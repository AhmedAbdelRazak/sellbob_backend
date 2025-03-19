// models/appointment.js

const mongoose = require("mongoose");
const { Schema } = mongoose;

const appointmentSchema = new Schema(
	{
		// Which property is associated with this appointment?
		propertyId: {
			type: Schema.Types.ObjectId,
			ref: "PropertyDetails",
			required: false, // or true if you want to enforce a property
		},
		// Basic property info (optional for quick reference):
		propertyName: {
			type: String,
			default: "",
		},

		// Agent info:
		agentId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		agentName: {
			type: String,
			default: "",
		},

		// Client info:
		clientId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: false,
		},
		clientName: {
			type: String,
			default: "",
		},
		phone: {
			type: String,
			default: "",
		},
		email: {
			type: String,
			default: "",
		},

		// Appointment details:
		appointmentDate: {
			type: Date,
			required: true,
		},
		appointmentTime: {
			type: String,
			default: "", // e.g. "10:00 AM" if you store time as string
		},
		appointmentStatus: {
			type: String,
			enum: ["pending", "confirmed", "completed", "cancelled"],
			default: "pending",
		},
		notes: {
			type: String,
			default: "",
		},

		// If you want a location separate from the property’s default address:
		location: {
			type: String,
			default: "",
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
