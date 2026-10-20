import "./report.hc" as reports
≔request←⤓⦃lower:Number,upper:Number,values:⟦Number⟧⦄⌨;
⎙(reports∷rangeReport(request·values,request·lower,request·upper));
