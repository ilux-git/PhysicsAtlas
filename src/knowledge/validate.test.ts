import { describe, expect, it } from 'vitest';
import type { Diagnostic, KnowledgeInput } from '../domain/types.ts';
import { makeValidInput } from '../test/fixtures.ts';
import { buildKnowledgeBase, errorDiagnostics } from './index.ts';

function codes(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((d) => d.code);
}

function mutated(change: (input: KnowledgeInput) => void): KnowledgeInput {
  const input = makeValidInput();
  change(input);
  return input;
}

describe('knowledge base validation', () => {
  it('accepts a valid fixture and builds the entity map', () => {
    const { kb, diagnostics } = buildKnowledgeBase(makeValidInput());
    expect(errorDiagnostics(diagnostics)).toHaveLength(0);
    expect(kb).not.toBeNull();
    expect(kb!.entities.size).toBe(16);
    expect(kb!.entities.get('q.speed')?.kind).toBe('quantity');
  });

  it('reports duplicate entity IDs', () => {
    const input = mutated((kb) => {
      const clone = structuredClone(kb.quantities[0]);
      kb.quantities.push(clone);
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('duplicate-id');
  });

  it('reports duplicate quantity symbols', () => {
    const input = mutated((kb) => {
      const clone = structuredClone(kb.quantities[0]);
      clone.id = 'q.distance-copy';
      kb.quantities.push(clone);
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('symbol-duplicate');
  });

  it('reports dangling references', () => {
    const input = mutated((kb) => {
      kb.quantities[0].dimensionId = 'dim.missing';
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('ref-missing');
  });

  it('reports references of the wrong entity kind', () => {
    const input = mutated((kb) => {
      kb.equations[0].lawRefs = ['unit.meter'];
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('ref-kind-mismatch');
  });

  it('reports a missing domain reference', () => {
    const input = mutated((kb) => {
      kb.quantities[0].domains = ['domain.missing'];
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('ref-missing');
  });

  it('reports a declared-explicit equation with no conditions', () => {
    const input = mutated((kb) => {
      kb.equations[0].conditionRefs = [];
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('conditions-missing');
  });

  it('reports AST variables without a quantity', () => {
    const input = mutated((kb) => {
      kb.equations[0].rhsAst = { type: 'variable', quantityId: 'q.unknown' };
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('ast-variable-missing');
  });

  it('reports a display formula that omits a variable symbol', () => {
    const input = mutated((kb) => {
      kb.equations[0].displayLatex = 'u = \\frac{s}{t}';
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('display-symbol-missing');
  });

  it('reports a derivation whose source equation does not exist', () => {
    const input = mutated((kb) => {
      kb.derivations[0].sourceEquationId = 'eq.missing';
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('ref-missing');
  });

  it('reports units that share a conversion group across dimensions', () => {
    const input = mutated((kb) => {
      const timeUnit = structuredClone(kb.units[2]);
      timeUnit.id = 'unit.bad-time';
      timeUnit.conversionGroup = 'length';
      kb.units.push(timeUnit);
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('unit-group-dimension');
  });

  it('rejects a completed expert review without reviewer and date', () => {
    const input = mutated((kb) => {
      kb.quantities[0].review = { formulation: 'standard-school', expert: 'completed' };
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).toContain('review-incomplete');
  });

  it('accepts a completed expert review with reviewer, date and source', () => {
    const input = mutated((kb) => {
      kb.quantities[0].review = {
        formulation: 'standard-school',
        expert: 'completed',
        reviewer: 'Тестовый рецензент',
        reviewedAt: '2026-11-22',
      };
    });
    const { diagnostics } = buildKnowledgeBase(input);
    expect(codes(diagnostics)).not.toContain('review-incomplete');
  });
});