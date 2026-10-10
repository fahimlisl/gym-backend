
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";
import { ApiError } from "../utils/ApiError.js";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";

const require = createRequire(import.meta.url);

const humanEntry = require.resolve("@vladmandic/human");
const humanDistDirectory = path.dirname(humanEntry);

const humanWasmUrl = pathToFileURL(
  path.join(humanDistDirectory, "human.node-wasm.js")
).href;

const humanModule = await import(humanWasmUrl);

const Human =
  humanModule.default?.default ??
  humanModule.default ??
  humanModule.Human;

const modelBasePath =
  process.env.FACE_MODEL_BASE_URL ||
  "http://127.0.0.1:3002/face-models/";

const wasmPackageEntry = require.resolve(
  "@tensorflow/tfjs-backend-wasm"
);

const wasmDirectory = path.dirname(wasmPackageEntry);
const wasmPath = wasmDirectory + path.sep;

const getThreshold = (name, fallback) => {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);

  return Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : fallback;
};

const FACE_MATCH_THRESHOLD = getThreshold(
  "FACE_MATCH_THRESHOLD",
  0.6
);

const FACE_DETECTION_THRESHOLD = getThreshold(
  "FACE_DETECTION_THRESHOLD",
  0.7
);

const FACE_ANTISPOOF_THRESHOLD = getThreshold(
  "FACE_ANTISPOOF_THRESHOLD",
  0.7
);

const FACE_LIVENESS_THRESHOLD = getThreshold(
  "FACE_LIVENESS_THRESHOLD",
  0.7
);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 12_000_000;

const REQUIRED_FRAMES = 3;
const REQUIRED_PASSING_FRAMES = 2;


const human = new Human({
  backend: "wasm",
  wasmPath,
  modelBasePath,

  cacheSensitivity: 0,
  softwareKernels: true,
  warmup: "face",
  debug: false,

  filter: {
    enabled: false,
  },

  face: {
    enabled: true,

    detector: {
      enabled: true,
      rotation: true,
      maxDetected: 2,
      minConfidence: FACE_DETECTION_THRESHOLD,
    },

    mesh: {
      enabled: true,
    },

    description: {
      enabled: true,
    },

    antispoof: {
      enabled: true,
    },

    liveness: {
      enabled: true,
    },

    iris: {
      enabled: false,
    },

    emotion: {
      enabled: false,
    },
  },

  body: {
    enabled: false,
  },

  hand: {
    enabled: false,
  },

  object: {
    enabled: false,
  },

  gesture: {
    enabled: false,
  },
});

const tf = human.tf;

let initializationPromise = null;

// Avoid concurrent inference on one shared Human instance.
let detectionQueue = Promise.resolve();

const runHumanDetection = (tensor) => {
  const operation = detectionQueue.then(() =>
    human.detect(tensor)
  );

  detectionQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
};


const initializeHuman = async () => {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      console.log("[FACE] Initializing Human.js WASM...");

      setWasmPaths(wasmPath);

      const backendReady = await tf.setBackend("wasm");

      if (!backendReady) {
        throw new Error(
          "Unable to initialize TensorFlow WASM backend."
        );
      }

      await tf.ready();

      console.log(
        "[FACE] Active TensorFlow backend:",
        tf.getBackend()
      );

      await human.load();

      console.log("[FACE] Face models loaded.");

      await human.warmup();

      console.log(
        "[FACE] Face recognition initialized."
      );
    })().catch((error) => {
      initializationPromise = null;
      console.error(
        "[FACE] Initialization failed:",
        error
      );
      throw error;
    });
  }

  return initializationPromise;
};


const validateImageBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ApiError(
      400,
      "A valid face image is required."
    );
  }

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new ApiError(
      413,
      "Face image is too large. Maximum size is 5 MB."
    );
  }
};


const decodeImageToTensor = async (imageBuffer) => {
  try {
    const { data, info } = await sharp(imageBuffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "error",
    })
      .rotate()
      .flatten({ background: "#ffffff" })
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels !== 3) {
      throw new Error(
        `Expected RGB image, received ${info.channels} channels.`
      );
    }

    return tf.tensor3d(
      new Uint8Array(data),
      [info.height, info.width, 3],
      "int32"
    );
  } catch (error) {
    console.error(
      "[FACE] Image decoding failed:",
      error
    );

    throw new ApiError(
      400,
      "Unable to decode the uploaded face image."
    );
  }
};


const detectSingleFace = async (imageBuffer) => {
  validateImageBuffer(imageBuffer);

  await initializeHuman();

  let decoded = null;
  let inputTensor = null;

  try {
    decoded = await decodeImageToTensor(imageBuffer);

    inputTensor = tf.tidy(() => {
      const floatImage = tf.cast(decoded, "float32");
      return tf.expandDims(floatImage, 0);
    });

    const result = await runHumanDetection(inputTensor);
    const faces = result?.face ?? [];

    if (faces.length === 0) {
      throw new ApiError(
        400,
        "No face detected. Please use a clear face photo."
      );
    }

    if (faces.length > 1) {
      throw new ApiError(
        400,
        "Only one person should be visible."
      );
    }

    const face = faces[0];

    const detectionScore =
      face.faceScore ?? face.boxScore ?? 0;

    if (detectionScore < FACE_DETECTION_THRESHOLD) {
      throw new ApiError(
        400,
        "Face detection confidence is too low."
      );
    }

    const embedding = face.embedding;

    if (
      !Array.isArray(embedding) ||
      embedding.length === 0 ||
      !embedding.every(Number.isFinite)
    ) {
      throw new ApiError(
        400,
        "Unable to generate a valid face embedding."
      );
    }

    return {
      embedding: [...embedding],
      detectionScore,
      realScore: face.real ?? null,
      liveScore: face.live ?? null,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error(
      "[FACE] Face detection failed:",
      error
    );

    throw new ApiError(
      500,
      "Unable to process face image."
    );
  } finally {
    inputTensor?.dispose();
    decoded?.dispose();
  }
};


export const generateReferenceFaceEmbedding = async (
  imageBuffer
) => {
  const face = await detectSingleFace(imageBuffer);

  return {
    embedding: face.embedding,
    detectionScore: face.detectionScore,
  };
};


export const verifyTrainerFace = async ({
  liveImageBuffers,
  referenceEmbeddings,
  referenceEmbedding,
}) => {
  const references =
    Array.isArray(referenceEmbeddings) &&
    referenceEmbeddings.length > 0
      ? referenceEmbeddings
      : referenceEmbedding
        ? [referenceEmbedding]
        : [];

  if (!references.length) {
    throw new ApiError(
      400,
      "Trainer face has not been enrolled."
    );
  }

  const validReferences = references.every(
    (embedding) =>
      Array.isArray(embedding) &&
      embedding.length > 0 &&
      embedding.every(Number.isFinite)
  );

  if (!validReferences) {
    throw new ApiError(
      500,
      "Stored trainer face embeddings are invalid."
    );
  }

  const embeddingLength = references[0].length;

  if (
    !references.every(
      (embedding) => embedding.length === embeddingLength
    )
  ) {
    throw new ApiError(
      500,
      "Stored face embeddings have incompatible dimensions."
    );
  }

  if (
    !Array.isArray(liveImageBuffers) ||
    liveImageBuffers.length !== 3 ||
    !liveImageBuffers.every(Buffer.isBuffer)
  ) {
    throw new ApiError(
      400,
      "Exactly three camera frames are required."
    );
  }

  const frameResults = [];

  for (const buffer of liveImageBuffers) {
    let face;

    try {
      face = await detectSingleFace(buffer);
    } catch (error) {
      if (
        error instanceof ApiError &&
        [400, 413].includes(error.statusCode)
      ) {
        frameResults.push({
          passed: false,
          reason: "unusable-image",
        });
        continue;
      }

      throw error;
    }

    if (face.embedding.length !== embeddingLength) {
      throw new ApiError(
        500,
        "Stored enrollment data is incompatible with the current face model."
      );
    }

    const authenticityPassed =
      Number.isFinite(face.realScore) &&
      face.realScore >= FACE_ANTISPOOF_THRESHOLD;

    const livenessPassed =
      Number.isFinite(face.liveScore) &&
      face.liveScore >= FACE_LIVENESS_THRESHOLD;

    const similarities = references.map((reference) =>
      human.match.similarity(
        reference,
        face.embedding
      )
    );

    if (!similarities.every(Number.isFinite)) {
      throw new ApiError(
        500,
        "Face similarity calculation failed."
      );
    }

    const bestSimilarity = Math.max(...similarities);

    const identityPassed =
      bestSimilarity >= FACE_MATCH_THRESHOLD;

    // A single frame must pass ALL checks.
    const passed =
      authenticityPassed &&
      livenessPassed &&
      identityPassed;

    frameResults.push({
      passed,
      authenticityPassed,
      livenessPassed,
      identityPassed,
      similarity: bestSimilarity,
      detectionScore: face.detectionScore,
      realScore: face.realScore,
      liveScore: face.liveScore,
    });
  }

  const accepted = frameResults.filter(
    (result) => result.passed
  );

  console.info("[FACE] Multi-reference verification", {
    referenceCount: references.length,
    framesEvaluated: frameResults.length,
    acceptedFrames: accepted.length,

    authenticityPassed: frameResults.filter(
      (result) => result.authenticityPassed
    ).length,

    livenessPassed: frameResults.filter(
      (result) => result.livenessPassed
    ).length,

    identityPassed: frameResults.filter(
      (result) => result.identityPassed
    ).length,

    frameSimilarities: frameResults.map(
      (result) =>
        Number.isFinite(result.similarity)
          ? Number(result.similarity.toFixed(4))
          : null
    ),
  });

  if (accepted.length < 2) {
    throw new ApiError(
      403,
      "Face verification failed. Please use even lighting and face the camera."
    );
  }

  // Choose a representative successful frame.
  accepted.sort(
    (a, b) => a.similarity - b.similarity
  );

  const representative =
    accepted[Math.floor((accepted.length - 1) / 2)];

  return {
    verified: true,
    similarity: representative.similarity,
    threshold: FACE_MATCH_THRESHOLD,
    detectionScore: representative.detectionScore,
    realScore: representative.realScore,
    liveScore: representative.liveScore,
    acceptedFrames: accepted.length,
    totalFrames: frameResults.length,
    referenceCount: references.length,
  };
};
