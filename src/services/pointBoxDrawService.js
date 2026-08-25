import pointBoxDrawRepo from "../repositories/pointBoxDrawRepository.js";

async function getAll() {
    return pointBoxDrawRepo.findAll();
}

export default {
    getAll,
};
