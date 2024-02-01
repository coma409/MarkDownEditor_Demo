// syncScroll.ts
export function handleInputScroll(vm: any) {
  vm.draggingInput = true;
  if (!vm.scrolling) {
    vm.scrolling = true;
    syncScroll(vm);
  }
}

export function handleOutputScroll(vm: any) {
  vm.draggingInput = false;
  if (!vm.scrolling) {
    vm.scrolling = true;
    syncScroll(vm);
  }
}

export function syncScroll(vm: any) {
  const inputScrollTop = vm.input.scrollTop;
  const outputScrollTop = vm.output.scrollTop;
  const inputScrollHeight = vm.input.scrollHeight;
  const outputScrollHeight = vm.output.scrollHeight;

  const inputRatio = inputScrollTop / (inputScrollHeight - vm.input.clientHeight);
  const outputRatio = outputScrollTop / (outputScrollHeight - vm.output.clientHeight);

  if (Math.abs(inputRatio - outputRatio) > 0.001) {
    const inputScrollOffset = (inputScrollHeight - vm.input.clientHeight) * outputRatio;
    const outputScrollOffset = (outputScrollHeight - vm.output.clientHeight) * inputRatio;

    if (vm.draggingInput) {
      vm.output.scrollTop = outputScrollOffset;
    } else {
      vm.input.scrollTop = inputScrollOffset;
    }
  }
  vm.scrolling = false;
}