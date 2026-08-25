import photocardService, {
  createPhotoCardWithUserCard,
} from '../services/photocardServices.js';

export async function create(req, res, next) {
  try {
    console.log('DEBUG: create called');
    console.log('DEBUG: body:', req.body);
    console.log('DEBUG: file:', req.file);

    const creatorUserId = Number(req.body?.creatorUserId);
    console.log('DEBUG: creatorUserId (parsed):', creatorUserId);

    let imageUrl = req.body?.imageUrl;
    if (req.file) {
      imageUrl = `/public/users/${creatorUserId}/photocards/${req.file.filename}`;
    }

    const data = await photocardService.createPhotoCard(creatorUserId, {
      name: req.body?.name,
      description: req.body?.description,
      genre: req.body?.genre,
      grade: req.body?.grade,
      minPrice: req.body?.minPrice,
      totalSupply: req.body?.totalSupply,
      imageUrl: imageUrl,
    });

    return res.status(201).json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

// GET /api/photo-cards?limit=20&cursor=123
export async function list(req, res, next) {
  try {
    const limit = Math.min(Number(req.query?.limit ?? 20) || 20, 50);
    const cursor = req.query?.cursor ? Number(req.query.cursor) : null;

    const data = await photocardService.listPhotoCards({ limit, cursor });
    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

// GET /api/photo-cards/:id
export async function get(req, res, next) {
  try {
    const id = Number(req.params?.id);
    const data = await photocardService.getPhotoCardById(id);
    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

// (호환용) 기존 이름을 쓰고 있으면 이렇게 위임해도 됨
export async function getPhotoCards(req, res, next) {
  return list(req, res, next);
}

// PATCH /api/photo-cards/:id
export async function update(req, res, next) {
  try {
    const id = Number(req.params?.id);
    const creatorUserId = Number(req.body?.creatorUserId);

    const data = await photocardService.updatePhotoCard(id, creatorUserId, {
      name: req.body?.name,
      description: req.body?.description,
      genre: req.body?.genre,
      grade: req.body?.grade,
      minPrice: req.body?.minPrice,
      totalSupply: req.body?.totalSupply,
      imageUrl: req.body?.imageUrl,
    });

    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

export async function createPhotocardWithUserCard(req, res, next) {
  try {
    const { card_name, card_type, description, owner_id, quantity } = req.body;
    if (!card_name || !card_type || !owner_id || !quantity) {
      return res.status(400).json({ ok: false, error: '필수값 누락' });
    }
    const photocard = await createPhotocard({
      card_name,
      card_type,
      description,
    });
    const createdUserId = req.user?.id || owner_id;
    // photocard 생성 후 user_card도 생성
    await createPhotocard.createUserCard({
      ownerId: owner_id,
      photocardId: photocard.id,
      createdUserId,
      quantity,
    });
    return res.status(201).json({ ok: true, photocard });
  } catch (err) {
    return next(err);
  }
}

export async function createWithUserCard(req, res, next) {
  try {
    const creatorUserId = Number(req.body?.creatorUserId);
    const payload = {
      name: req.body?.name,
      description: req.body?.description,
      genre: req.body?.genre,
      grade: req.body?.grade,
      minPrice: req.body?.minPrice,
      totalSupply: req.body?.totalSupply,
      imageUrl: req.body?.imageUrl,
    };
    const data = await createPhotoCardWithUserCard(creatorUserId, payload);
    return res.status(201).json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

// GET /api/photo-cards/users/:userId
export async function listUserCards(req, res) {
  const page = Number(req.query?.page ?? 1);
  const pageSize = Number(req.query?.pageSize ?? 15);

  return res.status(200).json({
    ok: true,
    data: {
      items: [],
      counts: { total: 0, common: 0, rare: 0, superRare: 0, legendary: 0 },
      pageInfo: { page, pageSize, totalItems: 0, totalPages: 1 },
    },
  });
}
