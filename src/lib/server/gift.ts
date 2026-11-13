// 책마을 — 친구에게 선물 보내기 (11-13 사용자: "친구에게 선물 보내기" + "선물을 직접 들고 가서 전달")
// 내 포인트로 사서 친구 방에 배달 상자로 — 친구가 자기 집에서 열면 바로 하고/놓는다. 둘만의 이야기에 '선물' 한 줄
// (내가 산 건 상자 없이 바로 쓰고, 상자는 선물일 때만)

import "server-only";
import { ObjectId } from "mongodb";
import { ITEM, kstDay, readDeco } from "@/lib/deco/items";
import { sendChat } from "./chat";
import { getDb, type PointLogDoc, type UserDoc } from "./db";
import { ensureEconomy } from "./deco";
import { BadRequestError } from "./errors";
import { friendByHandle } from "./friends";

export async function giftItem(viewer: UserDoc, handle: string, id: string): Promise<{ points: number; label: string }> {
  const item = ITEM[id];
  if (!item) throw new BadRequestError("모르는 물건이에요");
  const f = await friendByHandle(viewer, handle);
  if (f._id.equals(viewer._id)) throw new BadRequestError("나에게는 선물할 수 없어요");
  const friendDeco = readDeco(f.deco);
  if (friendDeco.owned.includes(id) || friendDeco.boxes.includes(id)) throw new BadRequestError(`${f.nickname}은 이미 가지고 있어요`);
  const me = await ensureEconomy(viewer);
  if ((me.points ?? 0) < item.price) throw new BadRequestError(`${item.price - (me.points ?? 0)} 포인트가 모자라요`);
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const paid = await users.updateOne({ _id: me._id, points: { $gte: item.price } }, { $inc: { points: -item.price } });
  if (!paid.modifiedCount) throw new BadRequestError("포인트가 모자라요");
  const sent = await users.updateOne({ _id: f._id, "deco.owned": { $ne: id }, "deco.boxes": { $ne: id } }, { $push: { "deco.boxes": id } });
  if (!sent.modifiedCount) {
    await users.updateOne({ _id: me._id }, { $inc: { points: item.price } }); // 그새 생겼으면 되돌린다
    throw new BadRequestError(`${f.nickname}은 이미 가지고 있어요`);
  }
  const now = new Date();
  await db.collection<PointLogDoc>("pointLog").insertOne({ _id: new ObjectId(), userId: me._id, reason: "buy", ref: `${id}:gift:${f.handle}:${now.getTime()}`, delta: -item.price, day: kstDay(now), note: `${f.nickname}에게 선물`, createdAt: now });
  await sendChat(viewer, handle, { text: "선물이야!" }, id).catch(() => {}); // 1초 안에 두 번이면 이야기 한 줄은 빠질 수 있다 — 선물은 그대로
  const after = await users.findOne({ _id: me._id }, { projection: { points: 1 } });
  return { points: after?.points ?? 0, label: item.label };
}
