/* Mark of what automated research found and has not been reviewed yet */
export function ReviewFlag(props: { text: string }) {
  return <span class="review-flag"><i aria-hidden="true" />{props.text}</span>;
}
