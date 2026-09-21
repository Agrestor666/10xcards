import { expect, test } from "@playwright/test";
import { cleanupOwnedResources, seedOwnedResources } from "./helpers/seed-owned-resources";

test("User B cannot access or mutate User A resources through application APIs", async ({ request }) => {
  const { ownerClient, setId, cardId, sentinel } = await seedOwnedResources();

  try {
    const renameResponse = await request.post("/api/flashcard-sets/update", {
      data: { id: setId, name: "Compromised by User B" },
    });
    expect(renameResponse.status()).toBe(404);
    expect(await renameResponse.text()).not.toContain(sentinel);

    const createCardResponse = await request.post("/api/flashcards/bulk-create", {
      data: {
        setId,
        cards: [{ question: "Forged question", answer: "Forged answer" }],
      },
    });
    expect(createCardResponse.status()).toBe(403);
    expect(await createCardResponse.text()).not.toContain(sentinel);

    const updateCardResponse = await request.post("/api/flashcards/update", {
      data: {
        setId,
        cardId,
        question: "Compromised question",
        answer: "Compromised answer",
      },
    });
    expect(updateCardResponse.status()).toBe(404);
    expect(await updateCardResponse.text()).not.toContain(sentinel);

    const deleteCardResponse = await request.post("/api/flashcards/delete", {
      data: { setId, cardId },
    });
    expect(deleteCardResponse.status()).toBe(404);
    expect(await deleteCardResponse.text()).not.toContain(sentinel);

    const dueResponse = await request.get("/api/srs/due", {
      params: { setId },
    });
    expect(dueResponse.status()).toBe(200);
    expect(await dueResponse.text()).not.toContain(sentinel);

    const deleteSetResponse = await request.post("/api/flashcard-sets/delete", {
      data: { id: setId },
    });
    expect(deleteSetResponse.status()).toBe(404);
    expect(await deleteSetResponse.text()).not.toContain(sentinel);

    const { data: ownerSet, error: setError } = await ownerClient
      .from("flashcard_sets")
      .select("name")
      .eq("id", setId)
      .single();
    expect(setError).toBeNull();
    expect(ownerSet?.name).toBe(sentinel);

    const { data: ownerCard, error: cardError } = await ownerClient
      .from("flashcards")
      .select("question, answer")
      .eq("id", cardId)
      .single();
    expect(cardError).toBeNull();
    expect(ownerCard).toEqual({
      question: `${sentinel}_QUESTION`,
      answer: `${sentinel}_ANSWER`,
    });
  } finally {
    await cleanupOwnedResources(ownerClient, setId);
  }
});
