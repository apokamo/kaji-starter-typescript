import "./target";

enum Mode {
  Ready,
}

const values: string[] = [];
const indexedValue: string = values[0];

interface OptionalValue {
  value?: string;
}

const optionalValue: OptionalValue = { value: undefined };

const neverRead = Mode.Ready;

function hasUnusedParameter(value: string): void {
  process.stdout.write("unused parameter fixture");
}

class Base {
  method(): void {}
}

class Derived extends Base {
  method(): void {}
}

function choose(value: number): string {
  switch (value) {
    case 0:
      process.stdout.write("fallthrough fixture");
    case 1:
      return "known";
    default:
      return "other";
  }
}

void indexedValue;
void optionalValue;
void hasUnusedParameter;
void Derived;
void choose;
