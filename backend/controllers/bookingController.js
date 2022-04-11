const { validationResult } = require("express-validator");

const bookingModel = require("../models/bookingModel");
const userModel = require("../models/userModel");

const nodemailer = require("./nodeMailerController");

const getAllBookings = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const bookingFilter = {};
  // If a booking's end time occurs before the start time specified in the
  // request, then we filter them out.
  if (req.body.startTime) {
    bookingFilter["endTime"] = { $gte: req.body.startTime };
  }
  // Similarly, if a booking's start time is after the end time specified in the
  // request, then we filter them out
  if (req.body.endTime) {
    bookingFilter["startTime"] = { $lte: req.body.endTime };
  }

  try {
    const bookings = await bookingModel
      .find(bookingFilter)
      .populate("bookedBy");
    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).send(err);
  }
};

const getOneBooking = async (req, res) => {
  try {
    const bookings = await bookingModel.findById(req.params.bookingId);
    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).send("Error in booking" + err);
  }
};

async function nodemailerSendMail(action,user,booking){
 await nodemailer.transporter.sendMail(
    action(user,booking)
  )
}


const sendBookingRequest = async (
  isBooking,
  booking,
  res,
  conflictbookingId = null,
  user = null
) => {
  try {
    if (!isBooking) {
      res
        .status(200)
        .send(
          "There are already slots booked on those days so book other slots"
        );
    } else {
      if (conflictbookingId != null)
        await bookingModel.findByIdAndRemove(conflictbookingId);
      const bookRequest = await bookingModel.create(booking);

      const bookingUser = await userModel.findById(user._id);
      bookingUser.bookings.unshift(bookRequest);
      bookingUser.save();

      if (bookingUser.role === "superAdmin") {
        for (let superAdmin in bookRequest.approvedBy)
          bookRequest.approvedBy[superAdmin] = "accepted";
        bookRequest.save();
      }
      res.status(200).json(bookRequest);
    }
  } catch (err) {
    res.status(500).send(err);
  }
};
const createBooking = async (req, res) => {
  //Main Idea:-
  /*1) see if there is a booking already in conflict with this
  2) If there are bookings in conflict
     a) if the user is an Admin (professors etc)
         -> allow booking and send for approval
         -> inform to the previously booked users via email
     b) if the user is a SuperAdmin
         -> allow booking without needing approval
         -> inform to the previously booked users via email
     c) if the user is a student
         -> inform them that there are already slots booked on those days
    If there is no conflict
     -> allow booking and send for approval*/

  //To create Dummy user for checking purpose
  /* const user = new userModel({
    emailId: "abc@iitbb.ac.in",
    userName: "Ritik",
    phoneNo: "8909876578",
    role: "superAdmin",
  });
  user
    .save()
    .then(() => {
      console.log("Dummy User Created");
    })
    .catch((err) => {
      console.log(err);
    });*/
  // req.user = await userModel.findById("61cac6fe09d781b9ce072bf3");
  //Creating a newBooking object
  const newBooking = {
    startTime: new Date(req.body.startTime),
    endTime: new Date(req.body.endTime),
    reason: req.body.reason,
    bookedBy: req.user, //it will req.user that is created at the start of the session and for checking it will be replaced by user
  };

  const bookingDetailsForMail = {
    startTime: newBooking.startTime,
    endTime: newBooking.endTime,
    reason: newBooking.reason,
  };
  //This will find all the existing booking
  const allbookings = await bookingModel.find();

  //This will fliter out the conflict containing booking
  const conflictbookings = allbookings.filter((booking) => {
    if (
      !(booking.startTime >= newBooking.endTime) &&
      !(booking.endTime <= newBooking.startTime)
    ) {
      return booking;
    }
  });

  let message =
    "There are already slots booked on those days so book other slots";
  //This will check for conflict booking and if it exist then it will populate the details of the booking and proceed according to main idea
  if (conflictbookings.length > 0) {
    conflictbookings.map(async (user) =>
      user.populate("bookedBy").then((conflictbooking) => {
        let isConflictBookingApproved = false,
          i = 0;

        for (const admin in conflictbooking.approvedBy) {
          if (conflictbooking.approvedBy[admin] === "accepted") i++;
        }
        isConflictBookingApproved = i === 3;
        if (newBooking.bookedBy.role === "superAdmin") {
          if (conflictbooking.bookedBy.role === "superAdmin") {
            //Tell new user that slots are already booked
            sendBookingRequest(false, message, res);
          } else {
            //create booking and no need for approval and tell the other conflict user(admin or student) that your booking is cancelled
            sendBookingRequest(
              true,
              newBooking,
              res,
              conflictbooking._id,
              req.user
            );
            let sentMail = null;
            //mail the super admin that his booking has been confirmed
            nodemailerSendMail(nodemailer.superBookingConfirmation,req.user,bookingDetailsForMail);
            // sentMail = nodemailer.transporter.sendMail(
            //   nodemailer.superBookingConfirmation(
            //     conflictbooking.bookedBy,
            //     bookingDetailsForMail
            //   )
            // );
            //mail tha conflicting booking user that his booking has been cancelled
            nodemailerSendMail(nodemailer.bookingCancellation,conflictbooking.bookedBy,null);
            // sentMail = nodemailer.transporter.sendMail(
            //   nodemailer.bookingCancellation(conflictbooking.bookedBy)
            // );
          }
        } else if (newBooking.bookedBy.role === "admin") {
          //If conflict booking is not approved till now then we have to create this booking
          if (!isConflictBookingApproved) {
            sendBookingRequest(true, newBooking, res, null, req.user);
            //mail the admin that his booking is confirmed
            nodemailerSendMail(nodemailer.waitForConfirmation,req.user,bookingDetailsForMail);
            // sentMail = nodemailer.transporter.sendMail(
            //   nodemailer.waitForConfirmation(
            //     conflictbooking.bookedBy,
            //     bookingDetailsForMail
            //   )
            // );
          } else if (conflictbooking.bookedBy.role === "student") {
            //Create the booking and send for approval and also tell the conflict user(student) that your booking is cancelled
            sendBookingRequest(
              true,
              newBooking,
              res,
              conflictbooking._id,
              req.user
            );
            // send the user a mail of his booking details
            nodemailerSendMail(nodemailer.waitForConfirmation,req.user,bookingDetailsForMail);
            // sentMail = nodemailer.transporter.sendMail(
            //   nodemailer.waitForConfirmation(req.user, bookingDetailsForMail)
            // );
            // send mail to the conflicting booking user that his booking has been cancelled
            nodemailerSendMail(nodemailer.bookingCancellation,conflictbooking.bookedBy,null);
            // sentMail = nodemailer.transporter.sendMail(
            //   nodemailer.bookingCancellation(req.user)
            // );
          } else {
            //Tell new user that slots are already booked
            sendBookingRequest(false, message, res);
          }
        } else {
          //If conflict booking is not approved till now then we have to create this booking
          if (!isConflictBookingApproved) {
            sendBookingRequest(true, newBooking, res, null, req.user);
            nodemailerSendMail(nodemailer.waitForConfirmation,req.user,bookingDetailsForMail);
            // sentMail = nodemailer.transporter.sendMail(
            //   nodemailer.waitForConfirmation(req.user, bookingDetailsForMail)
            // );
          } //Tell new user that slots are already booked
          else sendBookingRequest(false, message, res);
        }
      })
    );
  } else {
    //Create the booking as there are no conflict and send for approval
    sendBookingRequest(true, newBooking, res, null, req.user);
    nodemailerSendMail(nodemailer.waitForConfirmation,req.user,bookingDetailsForMail);
    // sentMail = nodemailer.transporter.sendMail(
    //   nodemailer.waitForConfirmation(req.user, bookingDetailsForMail)
    // );
  }
};

const deleteBooking = async (req, res) => {
  try {
    await bookingModel.findByIdAndRemove(req.params.bookingId);
    res.status(200).send("Booking deleted successfully");
  } catch (err) {
    res.status(500).send(err);
  }
};

//This updateBooking is changing the date, time and reason without approval of the superAdmins. This has to be worked upon.
const updateBooking = async (req, res) => {
  try {
    const updatedStartTime = req.body.startTime;
    const updatedEndTime = req.body.endTime;
    const updatedReason = req.body.reason;
    const result = await bookingModel.findByIdAndUpdate(
      req.params.bookingId,
      {
        $set: {
          startTime: updatedStartTime,
          endTime: updatedEndTime,
          reason: updatedReason,
        },
      },
      { new: true }
    );
    res.status(200).json(result);
  } catch (err) {
    res.status(500).send(err);
  }
};

module.exports = {
  getAllBookings,
  createBooking,
  getOneBooking,
  deleteBooking,
  updateBooking,
};
