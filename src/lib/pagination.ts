/** Keep paging even if the server imposes a smaller limit than requested. */
export async function readAll<T>(fetchPage: (offset: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const result: T[] = [];
  for (;;) {
    const { data, error } = await fetchPage(result.length, result.length + 499);
    if (error) throw new Error(error.message);
    if (!data?.length) return result;
    result.push(...data);
    if (result.length > 250_000) throw new Error("Narrow the facility or period before exporting this dataset.");
  }
}
