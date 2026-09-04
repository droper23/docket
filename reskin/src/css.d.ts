/** esbuild's `text` loader (see build.mjs) turns a `.css` import into its raw text content. */
declare module "*.css" {
  const content: string;
  export default content;
}
