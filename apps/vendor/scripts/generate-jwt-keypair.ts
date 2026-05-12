/**
 * One-shot script: generate an ES256 keypair for vendor portal SSO token
 * issuance. Output is printed to stdout — copy the two values into
 * Netlify env vars VENDOR_JWT_PRIVATE_KEY and VENDOR_JWT_PUBLIC_JWK.
 *
 * Usage:
 *   cd apps/vendor && npm run generate-jwt-keypair
 *
 * Do NOT commit the script's output. The script itself is fine to commit;
 * each run produces fresh keys. Re-run only when rotating.
 *
 * Why ES256: smaller keys + smaller JWTs than RSA at equivalent security.
 * jose handles signing/verification on both sides identically.
 */

import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

async function main() {
  const { publicKey, privateKey } = await generateKeyPair("ES256", {
    extractable: true,
  });

  const privatePem = await exportPKCS8(privateKey);
  const publicJwk = await exportJWK(publicKey);

  // kid is what the JWT header carries and what the JWKS endpoint exposes.
  // Using the date makes rotations easy to identify in logs ("which key
  // signed this token?"). If you rotate twice in one day, append a suffix.
  publicJwk.kid = `vendor-${new Date().toISOString().slice(0, 10)}`;
  publicJwk.use = "sig";
  publicJwk.alg = "ES256";

  console.log(
    "=== VENDOR_JWT_PRIVATE_KEY (PKCS#8 PEM) ===\n" +
      "Paste the entire block below — including the BEGIN/END lines — into Netlify env.\n" +
      "Netlify accepts multi-line values; just paste as-is.\n",
  );
  console.log(privatePem);

  console.log(
    "\n=== VENDOR_JWT_PUBLIC_JWK (single-line JSON) ===\n" +
      "Paste the line below into Netlify env. The jwks.ts function will\n" +
      "expose this at /.well-known/jwks.json wrapped in a key set.\n",
  );
  console.log(JSON.stringify(publicJwk));

  console.log(`\n=== KID for reference ===\n${publicJwk.kid}\n`);
  console.log(
    "After pasting both values into Netlify env (and any other env you " +
      "use for previews), redeploy and verify:\n" +
      "  curl https://vendor.cethos.com/.well-known/jwks.json\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
