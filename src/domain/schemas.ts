import { z } from 'zod';
import type { AstNode } from './types';

const localizedTextSchema = z
  .object({
    ru: z.string().min(1),
    en: z.string().min(1).optional(),
  })
  .strict();

const levelPresentationSchema = z
  .object({
    summary: localizedTextSchema,
    details: localizedTextSchema.optional(),
    mathNote: localizedTextSchema.optional(),
    extraLinks: z
      .array(z.object({ label: localizedTextSchema, targetId: z.string().min(3) }).strict())
      .optional(),
  })
  .strict();

const levelPresentationsSchema = z
  .object({
    '7-8': levelPresentationSchema.optional(),
    '9': levelPresentationSchema.optional(),
    '10-11': levelPresentationSchema.optional(),
  })
  .strict()
  .default({});

const reviewSchema = z
  .object({
    formulation: z.enum(['standard-school', 'definition', 'derived', 'draft']),
    expert: z.enum(['none', 'requested', 'completed', 'rejected']),
    reviewer: z.string().min(1).optional(),
    reviewedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    note: localizedTextSchema.optional(),
  })
  .strict();

const entityBaseSchema = z
  .object({
    id: z.string().min(3),
    slug: z.string().min(1),
    name: localizedTextSchema,
    aliases: z.array(localizedTextSchema).default([]),
    description: localizedTextSchema,
    levelPresentations: levelPresentationsSchema,
    domains: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    review: reviewSchema,
  })
  .strict();

export const astNodeSchema: z.ZodType<AstNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('variable'), quantityId: z.string().min(3) }).strict(),
    z
      .object({
        type: z.literal('constant'),
        name: z.string().min(1),
        value: z.number().finite(),
        display: z.string().min(1).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('add'),
        left: astNodeSchema,
        right: astNodeSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal('subtract'),
        left: astNodeSchema,
        right: astNodeSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal('multiply'),
        left: astNodeSchema,
        right: astNodeSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal('divide'),
        left: astNodeSchema,
        right: astNodeSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal('power'),
        base: astNodeSchema,
        exponent: z.number().int().min(-12).max(12),
      })
      .strict(),
    z.object({ type: z.literal('sqrt'), arg: astNodeSchema }).strict(),
    z.object({ type: z.literal('negate'), arg: astNodeSchema }).strict(),
  ]),
);

const alternativeFormSchema = z
  .object({
    id: z.string().min(3),
    note: localizedTextSchema,
    lhsAst: astNodeSchema,
    rhsAst: astNodeSchema,
    displayLatex: z.string().min(1),
  })
  .strict();

export const quantitySchema = entityBaseSchema
  .extend({
    kind: z.literal('quantity'),
    symbol: z.string().min(1),
    quantityKind: z.enum(['scalar', 'vector']),
    dimensionId: z.string().min(3),
    unitIds: z.array(z.string().min(3)),
    preferredUnitId: z.string().min(3),
    definition: localizedTextSchema,
  })
  .strict();

export const equationSchema = entityBaseSchema
  .extend({
    kind: z.literal('equation'),
    lhsAst: astNodeSchema,
    rhsAst: astNodeSchema,
    displayLatex: z.string().min(1),
    alternativeForms: z.array(alternativeFormSchema).default([]),
    lawRefs: z.array(z.string()),
    conditionRefs: z.array(z.string()),
    form: z
      .object({
        kind: z.enum(['magnitudes', 'vectors']),
        note: localizedTextSchema.optional(),
      })
      .strict(),
    conditionsStatus: z.enum(['explicit', 'missing']),
  })
  .strict();

export const lawSchema = entityBaseSchema
  .extend({
    kind: z.literal('law'),
    conditionRefs: z.array(z.string()),
  })
  .strict();

const structuredConstraintSchema = z
  .object({
    type: z.enum(['frame', 'constancy', 'direction', 'nonzero', 'material', 'regime']),
    quantityId: z.string().optional(),
    value: z.string().optional(),
    note: localizedTextSchema.optional(),
  })
  .strict();

export const conditionSchema = entityBaseSchema
  .extend({
    kind: z.literal('condition'),
    structured: structuredConstraintSchema.optional(),
  })
  .strict();

const derivationStepSchema = z
  .object({
    order: z.number().int().min(1),
    description: z.string().min(1),
    operation: z.enum([
      'divide-both-sides',
      'multiply-both-sides',
      'solve-for',
      'rewrite',
      'substitute',
    ]),
    displayFrom: z.string().min(1),
    displayTo: z.string().min(1),
    precondition: z.string().optional(),
  })
  .strict();

export const derivationSchema = entityBaseSchema
  .extend({
    kind: z.literal('derivation'),
    sourceEquationId: z.string().min(3),
    targetEquationId: z.string().min(3),
    steps: z.array(derivationStepSchema).min(1),
    preconditions: z.array(z.string()),
    verificationStatus: z.enum(['draft', 'structural']),
  })
  .strict();

export const unitSchema = entityBaseSchema
  .extend({
    kind: z.literal('unit'),
    symbol: z.string().min(1),
    dimensionId: z.string().min(3),
    system: z.enum(['SI', 'non-SI', 'accepted']),
    factor: z.number().finite().positive(),
    offset: z.number().finite().default(0),
    conversionGroup: z.string().min(1),
  })
  .strict();

const baseDimensionSchema = z.enum(['L', 'M', 'T', 'I', 'Th', 'N', 'J']);

export const dimensionSchema = entityBaseSchema
  .extend({
    kind: z.literal('dimension'),
    exponents: z
      .object({
        L: z.number().int(),
        M: z.number().int(),
        T: z.number().int(),
        I: z.number().int(),
        Th: z.number().int(),
        N: z.number().int(),
        J: z.number().int(),
      })
      .strict(),
  })
  .strict();

export const domainSchema = z
  .object({
    id: z.string().min(3),
    slug: z.string().min(1),
    name: localizedTextSchema,
    description: localizedTextSchema.optional(),
  })
  .strict();

export const sourceSchema = z
  .object({
    id: z.string().min(3),
    type: z.enum(['standard', 'textbook', 'curriculum', 'reference']),
    title: z.string().min(1),
    authors: z.string().optional(),
    edition: z.string().optional(),
    url: z.string().url().optional(),
    note: localizedTextSchema.optional(),
  })
  .strict();

export const knowledgeFileSchemas = {
  dimensions: z.array(dimensionSchema),
  units: z.array(unitSchema),
  quantities: z.array(quantitySchema),
  laws: z.array(lawSchema),
  conditions: z.array(conditionSchema),
  equations: z.array(equationSchema),
  derivations: z.array(derivationSchema),
  domains: z.array(domainSchema),
  sources: z.array(sourceSchema),
} as const;

export type RawKnowledgeFiles = {
  [K in keyof typeof knowledgeFileSchemas]: unknown;
};

export { baseDimensionSchema };