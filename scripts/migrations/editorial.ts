import { ContentSchema, type Content, type RichNode, type Block } from '@lzzhu/content';

/** Explicit, one-time authoring migration. No legacy shape is interpreted by the runtime. */
export function migrateEditorial(input: Content): Content {
  const content = structuredClone(input);
  const teaching = content.pages.find((page) => page.id === 'teaching');
  if (teaching && !teaching.blocks.some((block) => block.type === 'teaching')) {
    const [logo, body] = teaching.blocks;
    if (teaching.blocks.length !== 2 || logo.type !== 'image' || body.type !== 'richText')
      throw new Error('Teaching was edited: review its content before migration.');
    const nodes = body.document.content || [];
    const courses: Extract<Block, { type: 'teaching' }>['courses'] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const heading = nodes[i],
        paragraph = nodes[i + 1];
      const date = heading?.content?.[0]?.text?.match(/^(\d{4}) (Spring|Summer|Fall|Winter)$/);
      const title = paragraph?.content?.[0]?.text?.match(/^([^:]+): (.+)$/);
      if (
        heading?.type !== 'heading' ||
        paragraph?.type !== 'paragraph' ||
        !date ||
        !title ||
        paragraph.content?.[1]?.type !== 'hardBreak' ||
        paragraph.content.length !== 3
      )
        throw new Error('Unexpected teaching record: manual migration required.');
      courses.push({
        id: 'uva-' + date[1] + '-' + date[2].toLowerCase(),
        year: Number(date[1]),
        term: date[2] as 'Spring',
        code: title[1],
        title: title[2],
        position: paragraph.content[2].text || '',
        headingId: String(heading.attrs?.id || ''),
      });
    }
    teaching.blocks = [
      {
        id: 'teaching-uva',
        version: 1,
        type: 'teaching',
        institution: 'University of Virginia',
        logo: logo.src,
        showName: false,
        courses,
      },
    ];
  }
  const research = content.pages.find((page) => page.id === 'research');
  if (research && !research.blocks.some((block) => block.type === 'research')) {
    const [intro, image, body] = research.blocks;
    if (
      research.blocks.length !== 3 ||
      intro.type !== 'richText' ||
      image.type !== 'image' ||
      body.type !== 'richText'
    )
      throw new Error('Research was edited: review its content before migration.');
    const introNodes = intro.document.content || [],
      bodyNodes = body.document.content || [];
    const text = (node?: RichNode): string => node?.text || node?.content?.map(text).join('') || '';
    const split = bodyNodes.findIndex((node) => text(node) === 'fMRI-fNIRS');
    if (text(introNodes.at(-1)) !== 'PINN for ECG Signal Denoising' || split < 0)
      throw new Error('Unexpected research layout: manual migration required.');
    intro.document.content = introNodes.slice(0, -1);
    research.blocks = [
      intro,
      {
        id: 'research-ecg',
        version: 1,
        type: 'research',
        title: 'PINN for ECG Signal Denoising',
        paperLabel: 'Read paper',
        parts: [
          { id: image.id, type: 'image', src: image.src, alt: image.alt, width: image.width },
          { id: 'ecg-text', type: 'text', document: { type: 'doc', content: bodyNodes.slice(0, split) } },
        ],
      },
      {
        id: 'research-fmri',
        version: 1,
        type: 'research',
        title: 'fMRI-fNIRS',
        paperLabel: 'Read paper',
        parts: [
          { id: 'fmri-text', type: 'text', document: { type: 'doc', content: bodyNodes.slice(split + 1) } },
        ],
      },
    ];
  }
  return ContentSchema.parse(content);
}
