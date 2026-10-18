const test = require("node:test");
const assert = require("node:assert/strict");

const { loginSchema, signupSchema } = require("../dist/validators/auth.validator");

test("signup requires name, email, and password", () => {
  const missingName = signupSchema.safeParse({
    email: "person@example.com",
    password: "password123",
  });
  assert.equal(missingName.success, false);
  assert.ok(missingName.error.flatten().fieldErrors.name);

  const missingEmail = signupSchema.safeParse({
    name: "Anthony",
    password: "password123",
  });
  assert.equal(missingEmail.success, false);
  assert.ok(missingEmail.error.flatten().fieldErrors.email);

  const shortPassword = signupSchema.safeParse({
    name: "Anthony",
    email: "person@example.com",
    password: "short",
  });
  assert.equal(shortPassword.success, false);
  assert.ok(shortPassword.error.flatten().fieldErrors.password);
});

test("signup trims and accepts a valid display name", () => {
  const result = signupSchema.safeParse({
    name: "  Anthony  ",
    email: "person@example.com",
    password: "password123",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.name, "Anthony");
});

test("login only requires email and password", () => {
  const result = loginSchema.safeParse({
    email: "person@example.com",
    password: "password123",
  });

  assert.equal(result.success, true);
});
