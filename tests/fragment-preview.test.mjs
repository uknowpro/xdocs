import assert from "node:assert/strict";
import test from "node:test";
import { newComponent, fragmentIssues } from "../shared/architecture.mjs";
for (const [network, subnet, ref] of [
  ["aws_vpc", "aws_subnet", "vpc"],
  ["azurerm_virtual_network", "azurerm_subnet", "network"],
  ["google_compute_network", "google_compute_subnetwork", "network"],
]) {
  test(
    subnet +
      " overlaps only in the same network, including earlier preview siblings",
    () => {
      const vpc = newComponent(network),
        isolated = newComponent(network);
      if ("cidr" in vpc.props)
        vpc.props.cidr = isolated.props.cidr = "10.80.0.0/16";
      const a = newComponent(subnet),
        b = newComponent(subnet);
      Object.assign(a, { label: "A" });
      Object.assign(a.props, {
        name: "blue",
        cidr: "10.80.1.0/24",
        [ref]: vpc.id,
      });
      Object.assign(b, { label: "B" });
      Object.assign(b.props, {
        name: "green",
        cidr: "10.80.1.128/25",
        [ref]: vpc.id,
      });
      assert.match(
        fragmentIssues([vpc, isolated, a], [b]).join(),
        /CIDR 충돌.*A .*B /,
      );
      assert.match(fragmentIssues([vpc], [b, a]).join(), /CIDR 충돌/);
      b.props[ref] = isolated.id;
      assert.deepEqual(fragmentIssues([vpc, isolated, a], [b]), []);
      b.props[ref] = vpc.id;
      b.props.cidr = "10.80.2.0/24";
      assert.deepEqual(fragmentIssues([vpc, a], [b]), []);
      b.props.cidr = "10.900.0.0/24";
      assert.match(fragmentIssues([vpc, a], [b]).join(), /IPv4/);
    },
  );
}
