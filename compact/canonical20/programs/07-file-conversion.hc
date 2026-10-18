// Generic ⧄/⧇/⤒/⧅ conversion from permitted CSV to verified JSON bytes.
≔s←⧄⌨
≔rows←⧇⦃active:Bool,name:String,quantity:Number⦄s
≔json←⤒rows
print(⧅("converted.json",json))
