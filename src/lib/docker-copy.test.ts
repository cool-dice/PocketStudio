import { describe, expect, test } from "bun:test";

import {
  DOCKERFILE_MISSING_ERROR,
  DOCKERFILE_NOT_PUBLISHED,
  DOCKER_BUILD_LOCAL_ONLY,
  DOCKER_DAEMON_MISSING_LOG,
  EMPTY_APP_BUILD_ERROR,
  dockerCliMissingLog,
  hasBuildableAppFiles,
  hasDockerfile,
  isScaffoldFile,
} from "./docker-copy";

const FAKE_SUCCESS = /опубликован|собрано|published to registry|push succeeded/i;

describe("deploy honesty copy", () => {
  test("generate and empty copy never claim a published image", () => {
    const blob = [
      DOCKERFILE_NOT_PUBLISHED,
      EMPTY_APP_BUILD_ERROR,
      DOCKERFILE_MISSING_ERROR,
      DOCKER_DAEMON_MISSING_LOG,
      dockerCliMissingLog("abc12345", "/tmp/app"),
    ].join("\n");
    expect(blob).not.toMatch(FAKE_SUCCESS);
    expect(DOCKERFILE_NOT_PUBLISHED).toMatch(/не опубликован/i);
    expect(EMPTY_APP_BUILD_ERROR).toMatch(/пустой/i);
    expect(dockerCliMissingLog("abc12345", "/tmp/app")).toMatch(/docker build/i);
    expect(DOCKER_BUILD_LOCAL_ONLY).toMatch(/не публикация/i);
    expect(DOCKER_BUILD_LOCAL_ONLY).not.toMatch(FAKE_SUCCESS);
  });
});

describe("hasBuildableAppFiles", () => {
  test("empty tree and scaffold-only are not buildable", () => {
    expect(hasBuildableAppFiles([])).toBe(false);
    expect(
      hasBuildableAppFiles([
        { path: "Dockerfile", type: "file" },
        { path: ".dockerignore", type: "file" },
        { path: "README.md", type: "file" },
      ]),
    ).toBe(false);
    expect(isScaffoldFile("Dockerfile")).toBe(true);
    expect(hasDockerfile([{ path: "Dockerfile", type: "file" }])).toBe(true);
  });

  test("real source counts even next to a Dockerfile", () => {
    expect(
      hasBuildableAppFiles([
        { path: "Dockerfile", type: "file" },
        { path: "src/index.ts", type: "file" },
      ]),
    ).toBe(true);
    expect(
      hasBuildableAppFiles([{ path: "package.json", type: "file" }]),
    ).toBe(true);
    expect(isScaffoldFile("src/index.ts")).toBe(false);
  });
});
