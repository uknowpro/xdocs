import {compatibleFields,referenceTargets} from "./resource-form.mjs";
import { canPlace, placementFields } from "./network-boundaries.mjs";
export { canPlace };
export function reassignPlacement(model, child, parent) {
  if (!canPlace(model, child, parent))
    throw Error("직접 참조를 확인할 수 있는 호환 경계를 선택하세요.");
  if (!child.imported && child.props.arguments!==undefined) {
    const [key]=compatibleFields(child.kind,parent.kind);
    const args=JSON.parse(child.props.arguments);
    args[key]="${"+parent.kind+"."+parent.id+"."+referenceTargets[key][1]+"}";
    return {...model,nodes:model.nodes.map(n=>n.id===child.id?{...n,props:{...n.props,arguments:JSON.stringify(args,null,2)}}:n)};
  }
  const field = placementFields[child.kind][0];
  if (!child.imported)
    return {
      ...model,
      nodes: model.nodes.map((n) =>
        n.id === child.id
          ? { ...n, props: { ...n.props, [field]: parent.id } }
          : n,
      ),
    };
  const binding = child.placementSource;
  const file = model.sources.find((f) => f.name === binding.file);
  const old = child.scopeAddress,
    next = parent.address,
    at = binding.offset;
  if (
    !file ||
    !Number.isSafeInteger(at) ||
    at < 0 ||
    !old ||
    !file.content.startsWith(old + ".", at)
  )
    throw Error("원문 참조 위치가 달라졌습니다. Terraform을 다시 가져오세요.");
  const sources = model.sources.map((f) =>
    f !== file
      ? f
      : {
          ...f,
          content:
            f.content.slice(0, at) + next + f.content.slice(at + old.length),
        },
  );
  const nodes = model.nodes.map((n) => {
    if (n.id === child.id)
      return {
        ...n,
        scopeAddress: next,
        references: [...new Set([...binding.otherRefs, next])],
        placementSource: { ...binding, address: next },
      };
    const b = n.placementSource;
    return b?.file === file.name && b.offset > at
      ? {
          ...n,
          placementSource: {
            ...b,
            offset: b.offset + next.length - old.length,
          },
        }
      : n;
  });
  return { ...model, nodes, sources };
}
