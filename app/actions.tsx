"use server";

import { kv } from "@vercel/kv";
import { revalidatePath } from "next/cache";
import { Feature } from "./types";

export async function saveFeature(feature: Feature, formData: FormData) {
  let newFeature = {
    ...feature,
    title: formData.get("feature") as string,
  };
  await kv.hset(`item:${newFeature.id}`, newFeature);
  await kv.zadd("items_by_score", {
    score: Number(newFeature.score),
    member: newFeature.id,
  });

  revalidatePath("/");
}

export async function getFeatures() {
  try {
    let itemIds = await kv.zrange("items_by_score", 0, 100, {
      rev: true,
    });

    if (!itemIds.length) {
      return [];
    }

    let multi = kv.multi();
    itemIds.forEach((id) => {
      multi.hgetall(`item:${id}`);
    });

    let items: Feature[] = await multi.exec();
    return items.map((item) => {
      return {
        ...item,
        score: item.score,
        created_at: item.created_at,
      };
    });
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function saveEmail(formData: FormData) {
  const email = formData.get("email");

  function validateEmail(email: FormDataEntryValue) {
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  if (email && validateEmail(email)) {
    await kv.sadd("emails", email);
    revalidatePath("/");
  }
}

export async function upvote(feature: Feature) {
  const newScore = Number(feature.score) + 1;
  await kv.hset(`item:${feature.id}`, {
    ...feature,
    score: newScore,
  });

  await kv.zadd("items_by_score", { score: newScore, member: feature.id });

  revalidatePath("/");
}
