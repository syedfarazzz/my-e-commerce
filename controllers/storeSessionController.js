// sessionController.js
const Session = require('../models/storeSessionSchema');
const { STATUS_CODE, ERRORS } = require('../constants'); // Import constants if needed

exports.viewSessions = async (req, res, next) => {
    try {
        const userId = req.user._id; // Get userId from request params

        // Find all active sessions for the user
        const sessions = await Session.find({ userId });

        if (!sessions || sessions.length === 0) {
            return res.status(STATUS_CODE.NOT_FOUND).send({
                message: 'No active sessions found for this user',
            });
        }

        return res.status(STATUS_CODE.OK).send({
            message: 'Active sessions fetched successfully',
            sessions
        });
    } catch (err) {
        return res.status(STATUS_CODE.SERVER_ERROR).send({
            message: ERRORS.INVALID.INTERNAL_SERVER,
            error: err.message
        });
    }
};


exports.logout = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await Session.findOneAndDelete({ userId, _id: sessionId });
    
    if (!session) {
      return res.status(404).send({
        message: 'Session not found or already logged out',
      });
    }

    res.status(200).send({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).send({ message: 'Error logging out', error: error.message });
  }
};
  


exports.logoutAll = async (req, res) => {
  try {
    const userId = req.user._id;
    const deletedSessions = await Session.deleteMany({ userId });

    if (deletedSessions.deletedCount === 0) {
      return res.status(404).json({ message: 'No active sessions found to log out' });
    }

    res.status(200).json({ message: 'Logged out from all devices successfully' });
  } catch (error) {
    res.status(500).json({
      message: 'Error logging out from all devices',
      error: error.message,
    });
  }
};
  
  