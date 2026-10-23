import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Handshake } from "lucide-react";
import { formatPrice } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { TransactionConfirm } from "@/features/dashboard/TransactionConfirm";
import { getSession } from "@/services/auth.server";
import { getSupabaseServer } from "@/lib/supabase/server";

type Tx = {
  id: string; transaction_type: "sale" | "rent"; amount: number; status: string; buyer_id: string; seller_id: string;
  confirmed_by_buyer: boolean; confirmed_by_seller: boolean; commission_amount: number | null; created_at: string;
  property: { slug: string; title: string } | null;
};

export default async function TransactionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const format = await getFormatter();
  const { userId } = await getSession();
  let rows: Tx[] = [];
  if (userId) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from("transactions")
      .select("id, transaction_type, amount, status, buyer_id, seller_id, confirmed_by_buyer, confirmed_by_seller, commission_amount, created_at, property:properties(slug, title)")
      .order("created_at", { ascending: false });
    rows = (data ?? []) as unknown as Tx[];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
      <SectionTitle>{t("profile.myTransactions")}</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState icon={<Handshake className="size-5" />} title={t("common.none")} />
      ) : (
        <div className="space-y-3">
          {rows.map((tx) => {
            const isBuyer = tx.buyer_id === userId;
            const mustConfirm = tx.status === "pending" && (isBuyer ? !tx.confirmed_by_buyer : !tx.confirmed_by_seller);
            return (
              <Card key={tx.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/property/${tx.property?.slug}`} className="font-semibold hover:underline">{tx.property?.title}</Link>
                    <p className="text-[13px] text-muted">
                      {t(`listingTypes.${tx.transaction_type}`)} · {format.dateTime(new Date(tx.created_at), { dateStyle: "medium" })}
                    </p>
                  </div>
                  <Badge variant={tx.status === "completed" ? "green" : tx.status === "disputed" ? "outline" : "soft"}>{t(`transaction.status.${tx.status}` as never)}</Badge>
                </div>
                <p className="text-[22px] font-bold ltr-nums">{formatPrice(tx.amount)} MRU</p>
                {mustConfirm && <TransactionConfirm id={tx.id} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
