const asyncHandler = require('../utils/asyncHandler');

function createBnccController({ bnccService }) {
  const search = asyncHandler(async (req, res) => {
    const result = await bnccService.search(req.query);
    res.status(200).json(result);
  });

  const findByCode = asyncHandler(async (req, res) => {
    const skill = await bnccService.findByCode(req.params.code);
    res.status(200).json({ skill });
  });

  const semanticSearch = asyncHandler(async (req, res) => {
    const result = await bnccService.semanticSearch(req.body);
    res.status(200).json(result);
  });

  return {
    search,
    findByCode,
    semanticSearch,
  };
}

module.exports = createBnccController;
