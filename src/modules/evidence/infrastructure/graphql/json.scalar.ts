import { Scalar, type CustomScalar } from '@nestjs/graphql';
import { valueFromASTUntyped, type ValueNode } from 'graphql';

@Scalar('JSON')
export class JsonScalar implements CustomScalar<unknown, unknown> {
  readonly description = 'Arbitrary JSON value.';

  parseValue(value: unknown): unknown {
    return value;
  }

  serialize(value: unknown): unknown {
    return value;
  }

  parseLiteral(node: ValueNode): unknown {
    return valueFromASTUntyped(node);
  }
}
