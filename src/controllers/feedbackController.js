const asyncHandler = require('../utils/asyncHandler');

function createFeedbackController({ feedbackService }) {
  const save = asyncHandler(async (req, res) => {
    const feedback = await feedbackService.saveFeedback({
      userId: req.user.id,
      planId: req.params.id,
      input: req.body,
    });

    res.status(200).json({ feedback });
  });

  const find = asyncHandler(async (req, res) => {
    const feedback = await feedbackService.findFeedback({
      userId: req.user.id,
      planId: req.params.id,
    });

    res.status(200).json({ feedback });
  });

  return {
    save,
    find,
  };
}

module.exports = createFeedbackController;
