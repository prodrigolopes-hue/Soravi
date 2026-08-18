import assert from "node:assert/strict";
import test from "node:test";

import {
  appendServiceRequestPhotos,
  MAX_SERVICE_REQUEST_PHOTO_SIZE_BYTES,
  removeServiceRequestPhoto,
  uploadServiceRequestPhotos,
} from "./service-request-photo-selection";

test("aceita uma foto válida e até cinco fotos", () => {
  const firstResult = appendServiceRequestPhotos([], [photo("one.jpg")]);
  const fullResult = appendServiceRequestPhotos(
    firstResult.photos,
    [
      photo("two.png", "image/png"),
      photo("three.webp", "image/webp"),
      photo("four.jpg"),
      photo("five.jpg"),
    ],
  );

  assert.equal(firstResult.photos.length, 1);
  assert.equal(firstResult.errorMessage, null);
  assert.equal(fullResult.photos.length, 5);
  assert.equal(fullResult.errorMessage, null);
});

test("bloqueia a sexta foto", () => {
  const currentPhotos = Array.from({ length: 5 }, (_, index) =>
    photo(`${index}.jpg`),
  );
  const result = appendServiceRequestPhotos(currentPhotos, [photo("six.jpg")]);

  assert.equal(result.photos.length, 5);
  assert.match(result.errorMessage ?? "", /no máximo 5 fotos/u);
});

test("bloqueia arquivo maior que 5 MB e tipo inválido", () => {
  const result = appendServiceRequestPhotos([], [
    photo("large.jpg", "image/jpeg", MAX_SERVICE_REQUEST_PHOTO_SIZE_BYTES + 1),
    photo("document.pdf", "application/pdf"),
  ]);

  assert.equal(result.photos.length, 0);
  assert.match(result.errorMessage ?? "", /no máximo 5 MB/u);
  assert.match(result.errorMessage ?? "", /JPEG, PNG ou WebP/u);
});

test("remove uma foto antes do envio", () => {
  const photos = [photo("one.jpg"), photo("two.jpg")];

  assert.deepEqual(removeServiceRequestPhoto(photos, 0), [photos[1]]);
});

test("não envia nada quando a solicitação é criada sem fotos", async () => {
  let calls = 0;

  const failedUploads = await uploadServiceRequestPhotos(
    [],
    async () => {
      calls += 1;
    },
    () => undefined,
  );

  assert.equal(calls, 0);
  assert.equal(failedUploads, 0);
});

test("envia várias fotos uma por vez", async () => {
  let concurrentUploads = 0;
  let maximumConcurrentUploads = 0;
  const sentNames: string[] = [];
  const progressUpdates: Array<[number, number]> = [];
  const photos = [photo("one.jpg"), photo("two.jpg"), photo("three.jpg")];

  const failedUploads = await uploadServiceRequestPhotos(
    photos,
    async (selectedPhoto) => {
      concurrentUploads += 1;
      maximumConcurrentUploads = Math.max(
        maximumConcurrentUploads,
        concurrentUploads,
      );
      await Promise.resolve();
      sentNames.push(selectedPhoto.name);
      concurrentUploads -= 1;
    },
    (current, total) => progressUpdates.push([current, total]),
  );

  assert.deepEqual(sentNames, ["one.jpg", "two.jpg", "three.jpg"]);
  assert.deepEqual(progressUpdates, [
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
  assert.equal(maximumConcurrentUploads, 1);
  assert.equal(failedUploads, 0);
});

test("contabiliza falha parcial e continua os uploads", async () => {
  const attemptedNames: string[] = [];

  const failedUploads = await uploadServiceRequestPhotos(
    [photo("one.jpg"), photo("two.jpg"), photo("three.jpg")],
    async (selectedPhoto) => {
      attemptedNames.push(selectedPhoto.name);

      if (selectedPhoto.name === "two.jpg") {
        throw new Error("upload failed");
      }
    },
    () => undefined,
  );

  assert.deepEqual(attemptedNames, ["one.jpg", "two.jpg", "three.jpg"]);
  assert.equal(failedUploads, 1);
});

function photo(
  name: string,
  type = "image/jpeg",
  size = 1024,
): File {
  return { name, type, size } as File;
}